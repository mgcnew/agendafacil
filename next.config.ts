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
    // Upload de logo via server action — padrão é 1 MB; permite imagens maiores.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
