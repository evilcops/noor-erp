import type { NextConfig } from "next";

const ERP_ORIGIN = process.env.ERP_API_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${ERP_ORIGIN}/api/:path*` },
      { source: "/uploads/:path*", destination: `${ERP_ORIGIN}/uploads/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
    ],
  },
};

export default nextConfig;
