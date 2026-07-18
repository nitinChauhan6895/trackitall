// TrackItAll service worker — offline app shell.
//
// Strategy:
//   • build assets (/_next/static, icons, fonts) → cache-first (content-hashed)
//   • navigations + RSC payloads → stale-while-revalidate: serve the cached
//     page instantly and refresh it in the background. On a weak connection
//     this is the difference between an instant open and waiting on a slow
//     request. Uncached routes go to the network, falling back to /offline.
//   • everything else (POST, Supabase, auth) → untouched, straight to network
//
// Cached pages are personalised, so the app wipes every cache on sign-in
// (see lib/localCache.ts) to keep accounts separate on a shared device.
//
// Cache lifetimes are deliberately different:
//   STATIC is NOT versioned. Build output is content-hashed, so entries from
//   different releases can never collide — and keeping them means an update
//   doesn't throw away the assets that make the app work offline.
//   PAGES *is* versioned (/sw.js?v=<app version>), so a page cached from an
//   older build is dropped rather than served with JS chunks that no longer
//   exist.
//
// The offline fallback is a plain static HTML file with no JS, so it renders
// even when nothing else has been cached yet.

const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const STATIC = "tia-static";
const PAGES = `tia-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Keep STATIC and this release's PAGES; drop older page caches only.
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The app posts this on sign-in so one account never sees another's cache.
self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});

function isBuildAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpe?g|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Content-hashed build output: cache-first.
  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      ),
    );
    return;
  }

  const isNav = req.mode === "navigate";
  const isRsc = url.searchParams.has("_rsc");
  if (!isNav && !isRsc) return; // let auth/actions/data pass straight through

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);

      // Kick off the refresh regardless — it updates the cache for next time.
      const network = fetch(req)
        .then((res) => {
          // Don't cache redirects (e.g. the middleware bounce to /login).
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      // Stale-while-revalidate: if we have it, show it now and sync behind.
      if (cached) {
        event.waitUntil(network);
        return cached;
      }

      const res = await network;
      if (res) return res;
      if (isNav) {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return Response.error();
    })(),
  );
});
