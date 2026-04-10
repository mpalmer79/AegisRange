/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // Proxy API calls through the frontend so cookies stay same-origin.
    // BACKEND_URL is a server-side env var (not NEXT_PUBLIC_*) — it is
    // read at runtime, not baked into the build.
    const backend = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
