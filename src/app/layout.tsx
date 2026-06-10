import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";

// Fonte única do produto — moderna, levemente arredondada e familiar.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgendeFácil — Agendamento para salões e barbearias",
  description:
    "Sistema completo de agendamento, equipe, comissões, caixa e estoque para salões de beleza, barbearias e estética.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AgendeFácil", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f23c10",
  width: "device-width",
  initialScale: 1,
  // Necessário para env(safe-area-inset-*) funcionar no iOS (barra inferior do painel)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
