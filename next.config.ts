import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  // webpack config removed
};

export default nextConfig;