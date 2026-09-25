/**
 * Photo storage for the wizard: the optimised pixels, keyed by image id.
 *
 * IndexedDB rather than sessionStorage because photos are blobs measured in
 * megabytes, and sessionStorage holds ~5 MB of strings in total. The draft in
 * sessionStorage keeps each photo's metadata (schema.ts: ImageRef); this keeps
 * the bytes. The split means a draft opened on another device, or after site
 * data is cleared, still knows which photos it had — and can say so — instead
 * of silently losing them.
 *
 * Two renditions per photo: `full` for the guest-facing preview, and `thumb`
 * for grids, so a stop with eight photos never decodes eight full-size images
 * just to draw 130px tiles.
 */

export type ImageVariant = "full" | "thumb";

type StoredImage = { id: string; full: Blob; thumb: Blob };

const DB_NAME = "godnd-media";
const STORE = "images";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    // Resolve on commit, not on request success: a quota failure surfaces as
    // a transaction abort after the request itself has "succeeded".
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? request.error);
    tx.onerror = () => reject(tx.error ?? request.error);
  });
}

const urls = new Map<string, string>();
const key = (id: string, variant: ImageVariant) => `${id}:${variant}`;

export async function putImage(record: StoredImage): Promise<void> {
  await run("readwrite", (store) => store.put(record));
  // Prime the URL cache from the blobs in hand, so the tile that is about to
  // render does not read back what was just written.
  urls.set(key(record.id, "full"), URL.createObjectURL(record.full));
  urls.set(key(record.id, "thumb"), URL.createObjectURL(record.thumb));
}

/** Synchronous cache read, so an already-loaded photo renders without a flash. */
export function cachedImageUrl(id: string, variant: ImageVariant): string | undefined {
  return urls.get(key(id, variant));
}

/** An object URL for the photo, or null if it is not stored on this device. */
export async function imageUrl(id: string, variant: ImageVariant): Promise<string | null> {
  const cached = urls.get(key(id, variant));
  if (cached) return cached;
  try {
    const record = await run<StoredImage | undefined>("readonly", (store) => store.get(id));
    if (!record) return null;
    const url = URL.createObjectURL(record[variant]);
    urls.set(key(id, variant), url);
    return url;
  } catch {
    return null;
  }
}

function forget(id: string) {
  for (const variant of ["full", "thumb"] as const) {
    const url = urls.get(key(id, variant));
    if (url) URL.revokeObjectURL(url);
    urls.delete(key(id, variant));
  }
}

export async function deleteImage(id: string): Promise<void> {
  forget(id);
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    // Already gone, or storage unavailable — nothing left to clean up.
  }
}

export async function clearImages(): Promise<void> {
  for (const cacheKey of urls.keys()) forget(cacheKey.split(":")[0]);
  try {
    await run("readwrite", (store) => store.clear());
  } catch {
    // Storage unavailable; nothing was stored.
  }
}
