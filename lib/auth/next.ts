// Sanitises a post-auth redirect target. Only same-site relative paths pass:
// "/stats" and "/day/2026-11-06?x=1" are fine; "//evil.com", "/\\evil.com",
// "https://evil.com" and anything with control characters fall back.
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  try {
    // Resolve against a dummy origin: anything that escapes it isn't relative.
    const url = new URL(raw, "https://trackitall.invalid");
    if (url.origin !== "https://trackitall.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
