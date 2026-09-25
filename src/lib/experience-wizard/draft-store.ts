import { clearImages, deleteImage } from "@/lib/experience-wizard/image-db";
import {
  emptyDraft,
  type ExperienceDraft,
  type ImageRef,
} from "@/lib/experience-wizard/schema";
import type { WizardStepSlug } from "@/lib/experience-wizard/steps";

/**
 * The wizard draft, held outside React.
 *
 * sessionStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect. That
 * removes the cascading render on mount, and lets the server and the first
 * client render agree: both start from `serverSnapshot`, and React swaps in the
 * stored draft once hydration finishes.
 *
 * Why persist at all: operators fill these seven steps on patchy connections
 * in the Northeast. Losing a half-built itinerary to a dropped request is the
 * worst failure this form has, so every keystroke is mirrored locally and only
 * "Save as Draft" touches the network.
 *
 * sessionStorage rather than localStorage — a draft should not outlive the tab
 * and resurface weeks later as a surprise.
 */

const STORAGE_KEY = "godnd:experience-draft";

export type CompletedMap = Partial<Record<WizardStepSlug, boolean>>;

export type DraftSnapshot = {
  draft: ExperienceDraft;
  completed: CompletedMap;
  /**
   * The row this draft became on the server, once saved. Persisted with the
   * draft so a refresh mid-wizard keeps updating the same experience instead
   * of creating a second one on the next save.
   */
  experienceId: string | null;
  /**
   * The status the row had when the operator opened it to edit. Null in the
   * new-experience flow; set when an existing experience is loaded, so the
   * wizard can render a state-appropriate banner (“Editing withdraws the
   * submission” for under-review, “Changes requested” for rejected, etc.).
   */
  originalStatus: import("@/lib/types").ExperienceStatus | null;
  /** False until the stored draft has been read back. */
  hydrated: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
  /** Set when a save fails, so the failure is visible rather than silent. */
  saveError: string | null;
};

const serverSnapshot: DraftSnapshot = {
  draft: emptyDraft,
  completed: {},
  experienceId: null,
  originalStatus: null,
  hydrated: false,
  saving: false,
  lastSavedAt: null,
  saveError: null,
};

let snapshot: DraftSnapshot = serverSnapshot;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;

  let restored: Pick<
    DraftSnapshot,
    "draft" | "completed" | "experienceId" | "originalStatus"
  > = {
    draft: emptyDraft,
    completed: {},
    experienceId: null,
    originalStatus: null,
  };

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        draft?: Partial<ExperienceDraft>;
        completed?: CompletedMap;
        experienceId?: string | null;
        originalStatus?: DraftSnapshot["originalStatus"];
      };
      restored = {
        // Merged, not replaced: a draft saved before a field existed must not
        // render undefined into a controlled input.
        draft: { ...emptyDraft, ...parsed.draft },
        completed: parsed.completed ?? {},
        experienceId: parsed.experienceId ?? null,
        originalStatus: parsed.originalStatus ?? null,
      };
    }
  } catch {
    // Unreadable, corrupt, or blocked (private mode) — start clean.
  }

  snapshot = { ...snapshot, ...restored, hydrated: true };
}

function persist() {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        draft: snapshot.draft,
        completed: snapshot.completed,
        experienceId: snapshot.experienceId,
        originalStatus: snapshot.originalStatus,
      }),
    );
  } catch {
    // Storage full or blocked; the in-memory draft still works.
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): DraftSnapshot {
  load();
  return snapshot;
}

export function getServerSnapshot(): DraftSnapshot {
  return serverSnapshot;
}

function update(patch: Partial<DraftSnapshot>, shouldPersist = true) {
  snapshot = { ...snapshot, ...patch };
  if (shouldPersist) persist();
  emit();
}

export function setSection<K extends keyof ExperienceDraft>(
  key: K,
  values: ExperienceDraft[K],
) {
  update({ draft: { ...snapshot.draft, [key]: values } });
}

/**
 * Autosave write: persists immediately but does NOT notify subscribers.
 *
 * Persisting on every change rather than on a timer removes a whole class of
 * bug — anything still inside a debounce window is lost to a refresh, a closed
 * tab, or a quick step change, and an unload-time flush is not reliable enough
 * to depend on. The draft is a few KB, so a synchronous write per change costs
 * nothing measurable.
 *
 * Skipping the notify is what keeps that affordable: no component renders the
 * section currently being edited from this store (the form owns those values
 * while it is mounted), so waking every subscriber on each keystroke would be
 * re-render churn for no visible change. Readers pick the values up on their
 * next render, and `setSection` on submit notifies properly.
 */
export function stashSection<K extends keyof ExperienceDraft>(
  key: K,
  values: ExperienceDraft[K],
) {
  snapshot = { ...snapshot, draft: { ...snapshot.draft, [key]: values } };
  persist();
}

export function markComplete(slug: WizardStepSlug, complete: boolean) {
  update({ completed: { ...snapshot.completed, [slug]: complete } });
}

export function setSaving(saving: boolean) {
  update({ saving, saveError: null }, false);
}

/**
 * Records a successful save. The server id is persisted so the next save
 * updates this experience rather than creating another one.
 */
export function markSaved(experienceId: string | null) {
  snapshot = {
    ...snapshot,
    saving: false,
    lastSavedAt: new Date(),
    saveError: null,
    experienceId: experienceId ?? snapshot.experienceId,
  };
  persist();
  emit();
}

export function markSaveFailed(message: string) {
  update({ saving: false, saveError: message }, false);
}

export function resetDraft() {
  snapshot = { ...serverSnapshot, hydrated: true };
  void clearImages();
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  emit();
}

/**
 * Replace the entire draft with an existing experience the operator is now
 * editing. The experienceId + originalStatus pair is what marks the wizard as
 * being in edit mode. Every step is marked complete on the way in, because
 * every step already has real data from the row — the operator is refining,
 * not filling for the first time.
 */
export function loadForEdit({
  draft,
  experienceId,
  originalStatus,
}: {
  draft: ExperienceDraft;
  experienceId: string;
  originalStatus: import("@/lib/types").ExperienceStatus;
}) {
  const allComplete: CompletedMap = {
    "basic-info": true,
    itinerary: true,
    crew: true,
    pricing: true,
    availability: true,
    policies: true,
    media: true,
  };
  snapshot = {
    ...snapshot,
    draft,
    completed: allComplete,
    experienceId,
    originalStatus,
    hydrated: true,
    saveError: null,
  };
  persist();
  emit();
}

/* ------------------------------------------------------------------------ */
/* Photos                                                                    */
/* ------------------------------------------------------------------------ */

const imagesOf = () => snapshot.draft.images ?? [];

function writeImages(images: ImageRef[], media = snapshot.draft.media) {
  update({ draft: { ...snapshot.draft, images, media } });
}

/**
 * Adds a processed photo. `replaceOwner` is for single-photo slots (the custom
 * thumbnail): the new photo takes the slot and the old one is deleted, so a
 * replaced photo never lingers in storage.
 */
export function addImage(ref: ImageRef, { replaceOwner = false } = {}) {
  const replaced = replaceOwner ? imagesOf().filter((image) => image.owner === ref.owner) : [];
  const kept = imagesOf().filter((image) => !replaced.includes(image));
  const media =
    replaced.some((image) => image.id === snapshot.draft.media.thumbnailId)
      ? { ...snapshot.draft.media, thumbnailId: ref.id }
      : snapshot.draft.media;
  writeImages([...kept, ref], media);
  for (const image of replaced) void deleteImage(image.id);
}

/**
 * Removes photos. A removed photo that was the thumbnail clears the choice,
 * rather than leaving the listing pointing at a photo that no longer exists.
 */
function removeWhere(match: (image: ImageRef) => boolean) {
  const removed = imagesOf().filter(match);
  if (removed.length === 0) return;
  const media = removed.some((image) => image.id === snapshot.draft.media.thumbnailId)
    ? { ...snapshot.draft.media, thumbnailId: "" }
    : snapshot.draft.media;
  writeImages(imagesOf().filter((image) => !match(image)), media);
  for (const image of removed) void deleteImage(image.id);
}

export function removeImage(id: string) {
  removeWhere((image) => image.id === id);
}

/** Drops every photo of a stop, e.g. when the stop itself is deleted. */
export function removeImagesForOwner(owner: string) {
  removeWhere((image) => image.owner === owner);
}

/** Moves a photo one place earlier (-1) or later (+1) among its owner's photos. */
export function moveImage(id: string, delta: -1 | 1) {
  const images = [...imagesOf()];
  const from = images.findIndex((image) => image.id === id);
  if (from === -1) return;
  const owner = images[from].owner;
  let to = from + delta;
  while (to >= 0 && to < images.length && images[to].owner !== owner) to += delta;
  if (to < 0 || to >= images.length) return;
  [images[from], images[to]] = [images[to], images[from]];
  writeImages(images);
}

export function setImageAlt(id: string, alt: string) {
  writeImages(imagesOf().map((image) => (image.id === id ? { ...image, alt } : image)));
}
