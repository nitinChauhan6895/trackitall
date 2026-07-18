import Link from "next/link";

// Static fallback the service worker serves when a route hasn't been cached and
// there's no connection. Deliberately free of any personal data so it's safe to
// precache on a shared device.
export const dynamic = "force-static";

export const metadata = { title: "Offline · TrackItAll" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 text-center safe-top">
      <span aria-hidden className="text-5xl">
        📴
      </span>
      <h1 className="mt-4 text-xl font-bold text-ink">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted">
        This screen hasn&apos;t been saved for offline use yet. Pages you&apos;ve already
        visited will still open, and anything you log will sync once you&apos;re back
        online.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-2xl bg-green px-5 py-3 text-sm font-bold text-ink-inverse active:scale-95"
      >
        Go to home
      </Link>
    </main>
  );
}
