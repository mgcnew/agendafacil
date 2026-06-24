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
      // Router Cache: revisitar/voltar a uma página do painel renderiza
      // instantâneo (sem refetch) por até 30s. Mutações chamam router.refresh()
      // para revalidar, então o risco de dado velho é curto e controlado.
      dynamic: 30,
      static: 300,
    },
    // Upload de logo via server action — padrão é 1 MB; permite imagens maiores.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
