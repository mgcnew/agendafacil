import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // qualidades usadas via next/image (ex.: hero com quality={92})
    qualities: [75, 92],
  },
};

export default nextConfig;
