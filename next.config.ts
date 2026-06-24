import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 92],
    // Imagens da galeria/logo vêm do Supabase Storage.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    // Melhora o tree-shaking do framer-motion (usado em ~12 telas do painel).
    optimizePackageImports: ["framer-motion"],
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
