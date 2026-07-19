import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import OfflineSync from "@/components/OfflineSync";
import { APP_VERSION } from "@/lib/version";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "TrackItAll",
  description: "A mobile-first workout tracker.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/Logo.png",
    apple: "/icons/Logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrackItAll",
  },
};

export const viewport: Viewport = {
  themeColor: "#0C0D0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <OfflineSync />
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
            {children}
          </div>
          <BottomNav />
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

function ServiceWorkerRegister() {
  // Registering with ?v=<app version> means every release is a *different* SW
  // URL: the browser installs a fresh worker, whose activate() drops the
  // previous release's page cache. Without this, stale-while-revalidate can
  // serve a cached page from the old build whose JS chunks no longer exist.
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function () {
            var V = ${JSON.stringify(APP_VERSION)};
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js?v=' + V).then(function () {
                  // A fresh worker starts with an empty page cache. Warm the
                  // entry point straight away so going offline right after an
                  // update still opens the app instead of the fallback.
                  return navigator.serviceWorker.ready;
                }).then(function (reg) {
                  // The worker does the warming itself. Fetching from here
                  // instead would silently do nothing: a page fetch isn't a
                  // navigation, so the SW's fetch handler ignores it and the
                  // response never reaches the cache.
                  function warm() {
                    var sw = navigator.serviceWorker.controller ||
                      (reg && (reg.active || reg.waiting));
                    if (sw && navigator.onLine) sw.postMessage('warm-shells');
                  }
                  warm();
                  // Re-warm on reconnect so a session that started offline
                  // still ends up cached for the next cold start.
                  window.addEventListener('online', warm);
                }).catch(function () {});
              });
            }
            // Safety net: if a stale page still asks for a chunk that's gone,
            // reload once (bypassing the SW) instead of showing an error page.
            function recover(msg) {
              if (!msg || !/ChunkLoadError|Loading chunk|dynamically imported module/i.test(msg)) return;
              // Never do this offline: it would wipe the caches the app is
              // currently running from and strand the user on the fallback,
              // with no network to refetch anything.
              if (!navigator.onLine) return;
              if (sessionStorage.getItem('tia-chunk-reload') === V) return;
              sessionStorage.setItem('tia-chunk-reload', V);
              if (window.caches) { caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); }).finally(function () { location.reload(); }); }
              else location.reload();
            }
            window.addEventListener('error', function (e) { recover(e && e.message); });
            window.addEventListener('unhandledrejection', function (e) {
              recover(e && e.reason && (e.reason.message || String(e.reason)));
            });
          })();
        `,
      }}
    />
  );
}
