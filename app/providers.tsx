"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import Prefetcher from "@/components/Prefetcher";

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
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <Prefetcher />
      {children}
    </PersistQueryClientProvider>
  );
}
