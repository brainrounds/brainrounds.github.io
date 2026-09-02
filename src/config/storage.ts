/**
 * Reaching `localStorage` safely.
 *
 * Touching `window.localStorage` can THROW outright — inside a sandboxed frame
 * without same-origin, or when the browser is set to block site data. A guard
 * inside the calling function is too late: a `store = localStorage` default
 * argument is evaluated before the function body runs, so the throw escapes and
 * white-screens the whole app.
 *
 * Going through here means a blocked store costs the caregiver their saved
 * setup for that session, and nothing more.
 */

let resolved: Storage | null | undefined;

export function getStorage(): Storage | null {
  if (resolved === undefined) resolved = probe();
  return resolved;
}

function probe(): Storage | null {
  try {
    const store = globalThis.localStorage;
    if (!store) return null;
    // Some browsers hand over the object but throw on use, so actually write.
    const key = '__brain-rounds-probe__';
    store.setItem(key, '1');
    store.removeItem(key);
    return store;
  } catch {
    return null;
  }
}

/** Test seam: forget the cached result so the next call probes again. */
export function resetStorageForTests(): void {
  resolved = undefined;
}
