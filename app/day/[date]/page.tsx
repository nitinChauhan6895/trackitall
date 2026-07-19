"use client";

import { useRouteDate } from "@/lib/useRouteDate";
import DayView from "./DayView";
import DayLoading from "./loading";

// Client shell: no server data, and the date comes from the address bar. That
// makes the rendered HTML identical for every date, so the service worker can
// serve one cached shell for ANY /day/<date> — including days you've never
// opened before — and the exercises come from the local (IndexedDB) cache.
export default function DayPage() {
  const date = useRouteDate();
  if (!date) return <DayLoading />;
  return <DayView date={date} />;
}
