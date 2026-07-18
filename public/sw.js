// TrackItAll service worker — offline app shell.
//
// Strategy:
//   • build assets (/_next/static, icons, fonts) → cache-first (content-hashed)
//   • navigations + RSC payloads          → network-first, fall back to cache,
//                                            then to the static /offline page
//   • everything else (POST, Supabase, auth) → untouched, straight to network
//
// Cached pages are personalised, so the app wipes every cache on sign-in
// (see lib/localCache.ts) to keep accounts separate on a shared device.

const VERSION = "v2";
const STATIC = `tia-static-${VERSION}`;
const PAGES = `tia-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

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
    fetch(req)
      .then((res) => {
        // Don't cache redirects (e.g. the middleware bounce to /login).
        if (res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (isNav) {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return Response.error();
      }),
  );
});
