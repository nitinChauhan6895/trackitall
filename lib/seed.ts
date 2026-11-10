"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, type Query, type QueryKey } from "@tanstack/react-query";

// A server-rendered page already fetched its data. Without this, the client
// query then fetched the very same thing again straight after hydration (the
// app refetches on every mount), so every screen paid for its data twice.
//
// The server stamps the data with the time it was fetched. The client puts it
// into the query cache if it's newer than what's there, and skips the
// immediate refetch while it's only a few seconds old. Anything older (a page
// served from the offline cache, or a slow phone) still refetches, so the
// worst case is the old behaviour.

/** How old server data may be and still count as "just fetched". */
export const FRESH_MS = 6_000;

/** `refetchOnMount` for a seeded query: skip only data that is brand new. */
// Typed loosely on purpose: any query can use it, whatever its data shape.
export function refetchUnlessJustFetched(query: Pick<Query<any, any, any, any>, "state">): boolean | "always" {
  const age = Date.now() - (query.state.dataUpdatedAt || 0);
  return age < FRESH_MS ? false : "always";
}

/**
 * Seed the cache with this render's server data, before the screen's own
 * useQuery reads it. Re-seeds when a router.refresh() brings a newer stamp.
 */
export function useSeedQuery<T>(key: QueryKey, data: T, fetchedAt: number): void {
  const qc = useQueryClient();
  const seededAt = useRef<number | null>(null);

  const seed = () => {
    const state = qc.getQueryState(key);
    if (!state || (state.dataUpdatedAt ?? 0) < fetchedAt) {
      qc.setQueryData(key, data, { updatedAt: fetchedAt });
    }
  };

  // First render: synchronous, so the screen's useQuery sees it.
  if (seededAt.current === null) {
    seededAt.current = fetchedAt;
    seed();
  }
  // Later renders with a newer stamp (router.refresh): after commit.
  useEffect(() => {
    if (seededAt.current !== null && fetchedAt > seededAt.current) {
      seededAt.current = fetchedAt;
      seed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedAt]);
}
