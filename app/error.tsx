"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a screen throws while loading or rendering. Without this, Next
// shows its bare default page with no way back into the app.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep a trace in the console for debugging; the screen shows no raw text.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] flex-1 flex-col justify-center gap-6 px-5 pb-24 safe-top">
      <div className="flex flex-col gap-2.5 px-1">
        <h1 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.03em]">
          Something
          <br />
          <span className="text-green">went wrong.</span>
        </h1>
        <p className="text-[15px] leading-[1.45] text-muted">
          This screen couldn&apos;t load. Your data is safe. Try again, and if it keeps happening, check your connection.
        </p>
      </div>
      <div className="elevation-1 flex flex-col gap-3 rounded-[28px] p-5">
        <button
          type="button"
          onClick={reset}
          className="h-[52px] w-full rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98] motion-reduce:transition-none"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-[52px] w-full items-center justify-center rounded-full border border-white/[0.12] text-[15px] font-semibold active:bg-white/[0.06]"
        >
          Go to Home
        </Link>
        {error.digest && <p className="text-center text-xs text-subtle">Reference: {error.digest}</p>}
      </div>
    </main>
  );
}
