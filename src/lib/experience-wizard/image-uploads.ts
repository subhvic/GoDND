import * as draftStore from "@/lib/experience-wizard/draft-store";
import { putImage } from "@/lib/experience-wizard/image-db";
import type { ImageRef } from "@/lib/experience-wizard/schema";

/**
 * The photo upload pipeline, held outside React.
 *
 * A module store rather than component state for the same reason as the draft
 * store: an upload outlives the component that started it. An operator who
 * adds six photos to Day 1 and flips to Day 2 while they process must not lose
 * them, and the day tab unmounts Day 1's uploader.
 *
 * Each file moves through: queued -> reading -> optimising -> saving, then
 * leaves the job list and joins the draft as an ImageRef. Failures stay in the
 * list, on the tile, with the reason — a rejected photo that silently vanishes
 * is indistinguishable from one that was never picked.
 *
 * "Optimising" is real work, not decoration: phone photos arrive at 4-12 MB and
 * 4000px+, and guests see them at a fraction of that. Downscaling to 2400px
 * WebP typically cuts them by 80-90%, which is the difference between a
 * listing that loads on a 3G connection in the hills and one that does not.
 */

export const IMAGE_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  minShortSide: 600,
  perActivity: 8,
  fullLongSide: 2400,
  thumbLongSide: 480,
  types: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const ACCEPT_ATTR = IMAGE_LIMITS.types.join(",");

export type UploadStage = "queued" | "reading" | "optimising" | "saving";

export type UploadJob = {
  id: string;
  owner: string;
  fileName: string;
  fileBytes: number;
  status: "active" | "error";
  stage: UploadStage;
  /** 0-1 across all stages. */
  progress: number;
  error?: { message: string; retryable: boolean };
};

/** A screen-reader message, scoped to the uploader it belongs to. */
export type Announcement = { owner: string; text: string; seq: number } | null;

type Snapshot = { jobs: UploadJob[]; announcement: Announcement };

const CONCURRENCY = 2;

let snapshot: Snapshot = { jobs: [], announcement: null };
let seq = 0;
const listeners = new Set<() => void>();
const files = new Map<string, File>();
const controllers = new Map<string, AbortController>();
const replaceMode = new Set<string>();
const queue: string[] = [];
let running = 0;

const EMPTY: Snapshot = { jobs: [], announcement: null };

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => EMPTY;

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function patchJob(id: string, patch: Partial<UploadJob>) {
  set({ jobs: snapshot.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)) });
}

const say = (owner: string, text: string): Announcement => ({ owner, text, seq: ++seq });

function dropJob(id: string, announcement?: string) {
  const owner = snapshot.jobs.find((job) => job.id === id)?.owner ?? "";
  files.delete(id);
  controllers.delete(id);
  replaceMode.delete(id);
  set({
    jobs: snapshot.jobs.filter((job) => job.id !== id),
    ...(announcement ? { announcement: say(owner, announcement) } : {}),
  });
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / 1024 / 1024;
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

/** Checks that need no decoding — run before anything is queued. */
function precheck(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif")
  ) {
    return "HEIC photos (the iPhone default) can't be used yet. Export it as JPG and add it again.";
  }
  if (!(IMAGE_LIMITS.types as readonly string[]).includes(file.type)) {
    return "This isn't a JPG, PNG or WebP image.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > IMAGE_LIMITS.maxBytes) {
    return `This photo is ${formatBytes(file.size)}. The limit is ${formatBytes(IMAGE_LIMITS.maxBytes)}.`;
  }
  return null;
}

/**
 * Adds files to an owner (an itinerary stop, or the custom thumbnail slot).
 *
 * `max` counts photos already in the draft plus uploads still in flight, so
 * dropping 10 photos on a stop with 5 accepts 3 and explains the other 7 on
 * their own tiles. With `replace`, the slot holds one photo and a new upload
 * takes its place once it finishes (the old one stays visible until then).
 */
export function addFiles(
  fileList: Iterable<File>,
  owner: string,
  { max, replace = false }: { max: number; replace?: boolean },
) {
  const inDraft = replace
    ? 0
    : draftStore.getSnapshot().draft.images.filter((image) => image.owner === owner).length;
  const inFlight = snapshot.jobs.filter(
    (job) => job.owner === owner && job.status === "active",
  ).length;
  // A replace slot cancels whatever is in flight for it, so it always has room.
  let slots = replace ? 1 : max - inDraft - inFlight;

  const added: UploadJob[] = [];
  const incoming = [...fileList];
  // A replace slot only ever takes the last file picked.
  const candidates = replace ? incoming.slice(-1) : incoming;

  for (const file of candidates) {
    const id = newId();
    let problem = precheck(file);
    if (!problem && slots <= 0) {
      problem = `This stop already has ${max} photos. Remove one to add another.`;
    }

    if (replace && !problem) {
      // Cancel whatever was replacing the slot before.
      for (const job of snapshot.jobs.filter((item) => item.owner === owner)) cancel(job.id);
    }

    const job: UploadJob = {
      id,
      owner,
      fileName: file.name,
      fileBytes: file.size,
      status: problem ? "error" : "active",
      stage: "queued",
      progress: 0,
      error: problem ? { message: problem, retryable: false } : undefined,
    };
    added.push(job);
    if (!problem) {
      slots -= 1;
      files.set(id, file);
      if (replace) replaceMode.add(id);
      queue.push(id);
    }
  }

  const accepted = added.filter((job) => job.status === "active").length;
  const rejected = added.length - accepted;
  set({
    jobs: [...snapshot.jobs, ...added],
    announcement: say(
      owner,
      [
        accepted ? `Adding ${accepted} photo${accepted === 1 ? "" : "s"}.` : "",
        rejected ? `${rejected} couldn't be added — see the reasons on the tiles.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    ),
  });
  pump();
}

/** Stops a queued or in-progress upload and forgets it. */
export function cancel(id: string) {
  const index = queue.indexOf(id);
  if (index !== -1) queue.splice(index, 1);
  controllers.get(id)?.abort();
  const job = snapshot.jobs.find((item) => item.id === id);
  dropJob(id, job ? `Cancelled ${job.fileName}.` : undefined);
}

/** Clears a failed tile. */
export function dismiss(id: string) {
  dropJob(id);
}

export function retry(id: string) {
  if (!files.has(id)) return;
  patchJob(id, { status: "active", stage: "queued", progress: 0, error: undefined });
  queue.push(id);
  pump();
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const id = queue.shift()!;
    running += 1;
    void process(id).finally(() => {
      running -= 1;
      pump();
    });
  }
}

class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function process(id: string) {
  const file = files.get(id);
  const job = snapshot.jobs.find((item) => item.id === id);
  if (!file || !job) return;

  const controller = new AbortController();
  controllers.set(id, controller);
  const { signal } = controller;
  const alive = () => !signal.aborted && snapshot.jobs.some((item) => item.id === id);

  try {
    patchJob(id, { stage: "reading", progress: 0 });
    const buffer = await readFile(file, signal, (fraction) => {
      if (alive()) patchJob(id, { progress: fraction * 0.5 });
    });

    if (!alive()) return;
    patchJob(id, { stage: "optimising", progress: 0.55 });

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(new Blob([buffer], { type: file.type }));
    } catch {
      throw new UploadError("This image couldn't be opened. The file may be damaged.", false);
    }

    const { width: sourceWidth, height: sourceHeight } = bitmap;
    if (Math.min(sourceWidth, sourceHeight) < IMAGE_LIMITS.minShortSide) {
      bitmap.close();
      throw new UploadError(
        `Too small to look sharp on the listing (${sourceWidth}×${sourceHeight}). Use a photo at least ${IMAGE_LIMITS.minShortSide}px on its shortest side.`,
        false,
      );
    }

    const full = await encode(bitmap, IMAGE_LIMITS.fullLongSide);
    if (!alive()) return bitmap.close();
    patchJob(id, { progress: 0.75 });
    const thumb = await encode(bitmap, IMAGE_LIMITS.thumbLongSide);
    const { width, height } = scaled(bitmap, IMAGE_LIMITS.fullLongSide);
    bitmap.close();

    if (!alive()) return;
    patchJob(id, { stage: "saving", progress: 0.9 });

    const imageId = newId();
    try {
      await putImage({ id: imageId, full: full.blob, thumb: thumb.blob });
    } catch (error) {
      const quota = error instanceof DOMException && error.name === "QuotaExceededError";
      throw new UploadError(
        quota
          ? "Your browser is out of space for photos. Remove a few photos or free up space, then retry."
          : "This photo couldn't be saved in your browser. Retry, or check that site storage isn't blocked.",
        true,
      );
    }

    if (!alive()) return;
    const ref: ImageRef = {
      id: imageId,
      owner: job.owner,
      name: file.name,
      alt: "",
      width,
      height,
      bytes: full.blob.size,
      originalBytes: file.size,
    };
    draftStore.addImage(ref, { replaceOwner: replaceMode.has(id) });
    dropJob(id, `Added ${file.name}.`);
  } catch (error) {
    if (!alive()) return;
    const known = error instanceof UploadError;
    patchJob(id, {
      status: "error",
      error: {
        message: known ? error.message : "Something went wrong while adding this photo.",
        retryable: known ? error.retryable : true,
      },
    });
    set({ announcement: say(job.owner, `Couldn't add ${file.name}: ${known ? error.message : "unexpected error."}`) });
  } finally {
    controllers.delete(id);
  }
}

function readFile(
  file: File,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener("abort", abort, { once: true });
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    reader.onload = () => {
      signal.removeEventListener("abort", abort);
      onProgress(1);
      resolve(reader.result as ArrayBuffer);
    };
    reader.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    reader.onerror = () =>
      reject(new UploadError("This file couldn't be read. Retry, or pick it again.", true));
    reader.readAsArrayBuffer(file);
  });
}

function scaled(bitmap: ImageBitmap, longSide: number) {
  const ratio = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
  return {
    width: Math.round(bitmap.width * ratio),
    height: Math.round(bitmap.height * ratio),
  };
}

async function encode(bitmap: ImageBitmap, longSide: number): Promise<{ blob: Blob }> {
  const { width, height } = scaled(bitmap, longSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("Your browser couldn't process this photo.", false);
  // Listing photos are shown on white; flattening here keeps a transparent
  // PNG from turning black if the browser falls back to JPEG.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  let blob = await toBlob("image/webp");
  // Browsers without WebP encoding hand back a PNG; JPEG is far smaller.
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new UploadError("Your browser couldn't process this photo.", false);
  return { blob };
}
