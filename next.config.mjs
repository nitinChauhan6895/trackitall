/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Client router cache: reuse dynamic pages for 30s so back-nav and
    // day-arrow flips are instant. Saves still refresh via router.refresh().
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
