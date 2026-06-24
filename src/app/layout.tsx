import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Oswald } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";

// Fonte padrão do produto — moderna, levemente arredondada e familiar.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Fonte condensada para títulos — identidade de barbearia (placa/oficina).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgendeFácil — Agendamento para salões e barbearias",
  description:
    "Sistema completo de agendamento, equipe, comissões, caixa e estoque para salões de beleza, barbearias e estética.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AgendeFácil", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f23c10",
  width: "device-width",
  initialScale: 1,
  // Trava o zoom (pinça/duplo-toque) no Android e no iOS em modo PWA/standalone
  maximumScale: 1,
  userScalable: false,
  // Necessário para env(safe-area-inset-*) funcionar no iOS (barra inferior do painel)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${oswald.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
