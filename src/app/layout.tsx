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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://agendafacil-chi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AgendeFácil — Sistema de agendamento online para salões e barbearias",
    template: "%s · AgendeFácil",
  },
  description:
    "Software de agendamento online para salões de beleza, barbearias e clínicas de estética. Agenda, link de agendamento para clientes, comissões, caixa, estoque e relatórios. Teste grátis por 14 dias, sem cartão.",
  applicationName: "AgendeFácil",
  keywords: [
    "sistema de agendamento para salão",
    "agendamento online salão de beleza",
    "software para barbearia",
    "app de agendamento para barbearia",
    "agenda online para salão",
    "sistema para salão de beleza",
    "controle de comissão salão",
    "caixa e estoque para salão",
    "agendamento para estética",
    "link de agendamento WhatsApp",
  ],
  authors: [{ name: "AgendeFácil" }],
  creator: "AgendeFácil",
  publisher: "AgendeFácil",
  category: "business",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "AgendeFácil",
    title: "AgendeFácil — Agendamento online para salões e barbearias",
    description:
      "A cliente agenda pelo seu link, recebe confirmação automática e você só aparece para atender. Agenda, comissões, caixa e estoque. Teste grátis por 14 dias.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgendeFácil — Agendamento online para salões e barbearias",
    description:
      "Menos WhatsApp, mais clientes na cadeira. Agenda online, comissões, caixa e estoque. Teste grátis por 14 dias.",
  },
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
