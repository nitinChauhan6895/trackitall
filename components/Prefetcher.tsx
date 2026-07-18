"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchAllPrs,
  fetchDayExercises,
  fetchMonthSummary,
  fetchNutritionDiary,
  qk,
} from "@/lib/browserData";
import { toDateKey } from "@/lib/date";

// Warms the query cache for the screens you're most likely to open next, so the
// first tap paints instantly instead of waiting on a round-trip. Runs once per
// full app load (this stays mounted across client-side navigation), and only
// while online. Failures are swallowed — prefetching is best-effort.
export default function Prefetcher() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const today = new Date();
    const key = toDateKey(today);
    const y = today.getFullYear();
    const m = today.getMonth() + 1;

    const warm = () => {
      queryClient.prefetchQuery({ queryKey: qk.day(key), queryFn: () => fetchDayExercises(key) });
      queryClient.prefetchQuery({ queryKey: qk.diary(key), queryFn: () => fetchNutritionDiary(key) });
      queryClient.prefetchQuery({ queryKey: qk.month(y, m), queryFn: () => fetchMonthSummary(y, m) });
      queryClient.prefetchQuery({ queryKey: qk.prs(), queryFn: fetchAllPrs });
    };

    // Defer so it never competes with the current page's own fetches.
    const t = setTimeout(warm, 1200);
    return () => clearTimeout(t);
  }, [queryClient]);

  return null;
}
