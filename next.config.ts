import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 92],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 300,
    },
  },
};

export default nextConfig;
