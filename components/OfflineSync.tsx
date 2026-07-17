"use client";

import { useEffect, useState } from "react";
import { flushQueue, subscribeQueue } from "@/lib/offlineQueue";

// Global mount: watches connectivity, flushes the offline write queue on
// reconnect / load, and shows a small status pill when offline or syncing.
export default function OfflineSync() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      flushQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const unsub = subscribeQueue(setPending);
    flushQueue(); // catch up anything left from a previous session
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      unsub();
    };
  }, []);

  if (online && pending === 0) return null;

  const offline = !online;
  return (
    <div
      role="status"
      className={[
        "fixed inset-x-0 top-0 z-[60] mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+6px)]",
      ].join(" ")}
    >
      <div
        className={[
          "mx-auto flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg",
          offline ? "bg-orange text-white" : "bg-green text-ink-inverse",
        ].join(" ")}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${offline ? "bg-white" : "animate-pulse bg-ink-inverse"}`}
        />
        {offline
          ? pending > 0
            ? `Offline — ${pending} change${pending === 1 ? "" : "s"} will sync`
            : "Offline"
          : `Syncing ${pending} change${pending === 1 ? "" : "s"}…`}
      </div>
    </div>
  );
}
