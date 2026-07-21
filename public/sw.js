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
      .then(() => self.clients.claim())
      // A version bump empties PAGES, so refill it immediately. Without this
      // the app is NOT openable offline until you happen to visit each route
      // again while online.
      // force: the bump just emptied PAGES, so every entry is stale by
      // definition and the "skip what's cached" shortcut must not apply.
      .then(() => warmShells(true)),
  );
});

self.addEventListener("message", (event) => {
  // The app posts this on sign-in so one account never sees another's cache.
  if (event.data === "clear-caches") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
  // Posted after every load. Warming must happen HERE rather than in the page:
  // a plain fetch() from the page isn't a navigation, so the fetch handler
  // below ignores it and it never reaches the cache.
  // Replies with a per-URL result when a MessagePort is supplied, so warming
  // can be checked from the console instead of guessed at.
  if (event.data === "flush-queue") return handleFlushMessage(event);
  if (event.data === "warm-shells") {
    const port = event.ports && event.ports[0];
    event.waitUntil(
      warmShells()
        .catch((e) => [{ error: String(e && e.message ? e.message : e) }])
        .then((report) => port && port.postMessage(report)),
    );
  }
});

// ---- Background Sync: flush the offline write queue with the app closed ----
//
// The queue lives in IndexedDB, written by idb-keyval from the page. There's no
// idb-keyval here, so we talk to its store directly — these names are its
// defaults (see lib/offlineQueue.ts, which uses the default store).
const IDB_NAME = "keyval-store";
const IDB_STORE = "keyval";
const QUEUE_KEY = "trackitall-offline-queue";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // If the store doesn't exist yet the page has never queued anything.
    req.onupgradeneeded = () => {
      try {
        req.result.createObjectStore(IDB_STORE);
      } catch {}
    };
  });
}

function idbRequest(db, mode, fn) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(IDB_STORE, mode);
    } catch {
      return resolve(undefined); // no store => nothing queued
    }
    const req = fn(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readQueue() {
  const db = await idbOpen();
  try {
    const q = await idbRequest(db, "readonly", (s) => s.get(QUEUE_KEY));
    return Array.isArray(q) ? q : [];
  } finally {
    db.close();
  }
}

async function writeQueue(queue) {
  const db = await idbOpen();
  try {
    await idbRequest(db, "readwrite", (s) => s.put(queue, QUEUE_KEY));
  } finally {
    db.close();
  }
}

// Post the queue to /api/sync and keep whatever didn't apply.
//
// The same Web Lock the page's flush takes: the ops are at-least-once, so two
// concurrent replays would double-apply writes. Unlike the page (which skips
// if busy), waiting is right here — once the other flush finishes, whatever it
// couldn't drain is still ours to send.
function flushQueueFromSW() {
  if (self.navigator && navigator.locks && navigator.locks.request) {
    return navigator.locks.request("tia-flush", () => flushQueueFromSWUnlocked());
  }
  return flushQueueFromSWUnlocked();
}

async function flushQueueFromSWUnlocked() {
  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const res = await fetch("/api/sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ops: queue }),
  });
  // Signed out or server error: keep everything and let sync retry.
  // A redirect counts as a failure too — being bounced to a login page comes
  // back as a perfectly "ok" HTML response, which must not be read as success.
  if (!res.ok || res.redirected) {
    throw new Error("sync rejected: " + res.status + (res.redirected ? " (redirected)" : ""));
  }

  const statuses = await res
    .json()
    .then((b) => b && b.statuses)
    .catch(() => null);
  if (!Array.isArray(statuses)) throw new Error("bad sync response");

  // Statuses come back positionally, so pin each one to the op id it belongs
  // to before touching the queue again.
  const byId = new Map();
  queue.forEach((op, i) => byId.set(op.id, statuses[i]));

  // Re-read rather than reusing `queue`: the page may have queued or flushed
  // something while the request was in flight. Matching on id (not index)
  // means a shifted queue can't misattribute a result and drop a live write.
  const latest = await readQueue();
  const remaining = [];
  let flushed = 0;
  for (const op of latest) {
    const status = byId.get(op.id);
    if (status === "ok") flushed++;
    else if (status === "drop") continue; // discarded on purpose
    else remaining.push(op); // fail, keep, or queued after we sent
  }
  await writeQueue(remaining);

  if (flushed > 0) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    for (const c of clients) c.postMessage("queue-flushed");
  }
  return { flushed, remaining: remaining.length };
}

self.addEventListener("sync", (event) => {
  // Rejecting tells the browser to retry later with its own backoff.
  if (event.tag === "tia-flush") event.waitUntil(flushQueueFromSW());
});

// Same flush, triggered explicitly. Lets the app hand a flush to the worker,
// and makes this path checkable from the console without waiting on the
// browser to decide it's a good time to fire a sync event.
function handleFlushMessage(event) {
  const port = event.ports && event.ports[0];
  event.waitUntil(
    flushQueueFromSW()
      .then((r) => port && port.postMessage(r))
      .catch((e) => port && port.postMessage({ error: String(e && e.message ? e.message : e) })),
  );
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Fetch the entry point and one /day + /log page, storing each under its own
// URL *and* under the date-agnostic shell key, so any date works offline.
async function warmShells(force) {
  const today = todayISO();
  const c = await caches.open(PAGES);
  // Every bottom-nav destination, so moving around the app offline works —
  // not just the two workout screens.
  const paths = [
    "/",
    "/community",
    "/stats",
    "/coach",
    "/nutrition",
    `/day/${today}`,
    `/log/${today}`,
  ];
  return Promise.all(
    paths.map(async (path) => {
      try {
        // Steady state costs nothing: only fetch what's missing. Visiting a
        // page refreshes it anyway (stale-while-revalidate below), and a new
        // day is the only thing that reintroduces a gap.
        if (!force && (await c.match(path, { ignoreVary: true }))) {
          return { path, cached: true, skipped: "already cached" };
        }
        const res = await fetch(path, { credentials: "include" });
        // A signed-out warm follows the middleware bounce to /login; caching
        // that would show a login screen for every offline route.
        if (!res.ok || res.redirected) return { path, cached: false, status: res.status, redirected: res.redirected };
        const url = new URL(path, self.location.origin);
        await c.put(url.href, res.clone());
        const key = shellKeyFor(url, false);
        if (key) await c.put(key, res.clone());
        return { path, cached: true, shell: key ? new URL(key).pathname : null };
      } catch (e) {
        // Offline during warm-up: whatever is already cached still stands.
        return { path, cached: false, error: String(e) };
      }
    }),
  );
}

// /day/<date> and /log/<date> render from a shared client shell that reads the
// date out of the address bar, so ONE cached copy can serve every date —
// including days never opened before. We stash a copy under a family key and
// fall back to it on a miss.
function shellKeyFor(url, isRsc) {
  const p = url.pathname;
  const family = /^\/day\/\d{4}-\d{2}-\d{2}/.test(p)
    ? "day"
    : /^\/log\/\d{4}-\d{2}-\d{2}/.test(p)
      ? "log"
      : null;
  if (!family) return null;
  return `${self.location.origin}/__shell/${family}${isRsc ? ".rsc" : ""}`;
}

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

  const shellKey = shellKeyFor(url, isRsc);

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);

      // Kick off the refresh regardless — it updates the cache for next time.
      const network = fetch(req)
        .then((res) => {
          // Don't cache redirects (e.g. the middleware bounce to /login).
          if (res.ok && !res.redirected) {
            // Clone SYNCHRONOUSLY. caches.open() is async, and by the time it
            // resolves this response has been handed to the browser and its
            // body consumed — cloning there throws and nothing is ever cached.
            const copy = res.clone();
            // Keep a date-agnostic copy so any other date can reuse it.
            const shellCopy = shellKey ? res.clone() : null;
            event.waitUntil(
              caches
                .open(PAGES)
                .then(async (c) => {
                  await c.put(req, copy);
                  if (shellCopy) await c.put(shellKey, shellCopy);
                })
                .catch(() => {}),
            );
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

      // Offline and this exact date was never cached.
      //
      // For a document navigation, reuse the date-agnostic shell: the page
      // reads its date from the address bar, so one copy serves every date.
      //
      // For an RSC payload we deliberately DON'T, and let the request fail:
      // the cached payload carries a router state tree pinned to the date it
      // was fetched for. Failing makes Next fall back to a full browser
      // navigation, which lands on the HTML shell above with the right URL.
      if (isNav && shellKey) {
        const shell = await caches.match(shellKey, { ignoreVary: true });
        if (shell) return shell;
      }
      if (isNav) {
        const offline = await caches.match(OFFLINE_URL, { ignoreVary: true });
        if (offline) return offline;
      }
      return Response.error();
    })(),
  );
});

// ---- Push notifications ----
//
// A push message is the only thing that can wake this worker once the app is
// closed, which is why habit reminders go through a server rather than being
// scheduled locally (the web has no working API for that).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "TrackItAll";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // Same icon as the launcher so the notification is recognisably the app.
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Replaces an earlier copy of the same reminder rather than stacking.
      tag: data.tag || "trackitall",
      renotify: false,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reuse an open window if there is one — opening a second copy of an
      // installed PWA is jarring.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {}
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
