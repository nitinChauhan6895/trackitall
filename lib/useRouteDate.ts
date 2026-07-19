"use client";

import { useEffect, useState } from "react";

const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

// Reads the YYYY-MM-DD segment straight from the address bar.
//
// Why not useParams(): offline, the service worker serves ONE cached shell for
// every /day/* (or /log/*) URL, so the router params baked into that shell
// belong to whichever date was cached — but the address bar is always correct.
// Reading it after mount also keeps the server and first client render
// identical, so there's no hydration mismatch.
export function useRouteDate(): string | null {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(DATE_RE);
    setDate(match ? match[1] : null);
  }, []);

  return date;
}
