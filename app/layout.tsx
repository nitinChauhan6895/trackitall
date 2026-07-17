import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import OfflineSync from "@/components/OfflineSync";
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
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function () {});
            });
          }
        `,
      }}
    />
  );
}
