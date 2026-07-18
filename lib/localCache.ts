import { del } from "idb-keyval";

// Wipes locally cached *content* — service-worker page caches and the persisted
// React Query cache. Called on sign-in so one account never sees another's
// cached pages/data on a shared device.
//
// Deliberately does NOT touch the offline write queue: those are unsynced user
// writes. Cross-account safety for the queue is handled by stamping each op
// with its user id (see lib/offlineQueue.ts).
export async function clearLocalCaches(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* best effort */
  }
  try {
    await del("trackitall-query-cache");
  } catch {
    /* best effort */
  }
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-caches");
  } catch {
    /* best effort */
  }
}
