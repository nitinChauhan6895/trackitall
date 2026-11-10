"use client";

// Last-resort screen for a crash in the root layout itself. It replaces the
// whole document, so the app's stylesheet isn't loaded here: styles are inline.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#111111", color: "#F2F2F2", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 448, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "0 20px" }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Something
            <br />
            <span style={{ color: "#22C55E" }}>went wrong.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "#A6A6A6" }}>
            TrackItAll couldn&apos;t start. Your data is safe. Try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ height: 52, border: 0, borderRadius: 999, background: "#22C55E", color: "#111111", fontSize: 16, fontWeight: 600 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
