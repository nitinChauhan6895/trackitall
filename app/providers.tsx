"use client";

import { useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { QueryClient, QueryClientProvider, defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import Prefetcher from "@/components/Prefetcher";
import { APP_VERSION } from "@/lib/version";
import { toDateKey } from "@/lib/date";

// What gets saved to the phone. The whole cache is re-serialised on every
// change, so it should hold only what makes the next app open instant:
// - not the raw workout log behind PRs (it grows with every workout and is
//   refetched seconds after start-up by the Prefetcher);
// - date-keyed screens (a day, a nutrition diary, the log wizard's context)
//   only for the last week; months only this one and the one before.
// Everything else is small (habits, goals, measurements, stats, ...).
const NOT_PERSISTED = new Set(["prSources"]);
const DATED = new Set(["day", "diary", "logContext"]);
const RECENT_DAYS = 7;

function shouldPersist(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false; // only successful data
  const [kind, a, b] = query.queryKey as unknown[];
  if (typeof kind !== "string" || NOT_PERSISTED.has(kind)) return false;
  const now = new Date();
  if (DATED.has(kind) && typeof a === "string") {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
    return a >= toDateKey(cutoff);
  }
  if (kind === "month" && typeof a === "number" && typeof b === "number") {
    const monthsAgo = (now.getFullYear() - a) * 12 + (now.getMonth() + 1 - b);
    return monthsAgo <= 1;
  }
  return true;
}

// IndexedDB-backed storage for the persisted query cache.
const idbStorage = {
  getItem: (key: string) => get<string>(key).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cache instantly, always refetch in the background so data
        // reconciles quickly (browser → Mumbai Supabase is ~50–80ms).
        staleTime: 0,
        gcTime: 1000 * 60 * 60 * 24, // keep 24h so persistence stays useful
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeClient);
  const [persister] = useState(() =>
    typeof window === "undefined"
      ? null
      : createAsyncStoragePersister({
          storage: idbStorage,
          key: "trackitall-query-cache",
          throttleTime: 1000,
        }),
  );

  // Server render (and the pre-hydration client render) has no persister.
  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        // A new release starts from a clean cache, so an old data shape is
        // never read back by new code.
        buster: APP_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      <Prefetcher />
      {children}
    </PersistQueryClientProvider>
  );
}
