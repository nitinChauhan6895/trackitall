"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";

// Instant edits: change the cached data first so the screen updates on the
// tap, send the save in the background, and put the old data back if the
// save fails. Either way the query is refetched afterwards so the cache ends
// up matching the database.

/** Shows a short message in the app's toast (components/FlashToast.tsx). */
export function showToast(text: string, tone: "ok" | "error" = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { text, tone } }));
}

export async function optimisticUpdate<T>(
  qc: QueryClient,
  key: QueryKey,
  update: (old: T) => T,
  save: () => Promise<unknown>,
  failMessage = "Couldn't save. Your change was undone.",
): Promise<boolean> {
  // A refetch already in flight would land after our edit and undo it.
  await qc.cancelQueries({ queryKey: key });
  const prevState = qc.getQueryState<T>(key);
  const prev = qc.getQueryData<T>(key);
  if (prev !== undefined) {
    // Keep the old timestamp: the edit isn't server data, so a fresh server
    // render (see lib/seed.ts) must still be allowed to replace it.
    qc.setQueryData<T>(key, update(prev), { updatedAt: prevState?.dataUpdatedAt });
  }
  try {
    await save();
    return true;
  } catch {
    if (prev !== undefined) qc.setQueryData<T>(key, prev, { updatedAt: prevState?.dataUpdatedAt });
    showToast(failMessage, "error");
    return false;
  } finally {
    qc.invalidateQueries({ queryKey: key });
  }
}

/** A stand-in id for a row that hasn't been saved yet. */
export function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
