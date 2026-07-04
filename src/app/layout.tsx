import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Oswald, Playfair_Display } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { MotionProvider } from "@/components/MotionProvider";

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
  // Só é usada em títulos de barbearia — não pré-carregar (peso morto na
  // landing/SEO). Carrega sob demanda (swap) quando uma página de barbearia usa.
  preload: false,
});

// Display serifado elegante para os títulos dos nichos de beleza
// (feminino/estética) — dá o ar de spa/salão sofisticado. Só em títulos;
// não pré-carrega (a landing usa Jakarta).
const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://agendafacil-chi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zulan — Sistema de agendamento online para salões e barbearias",
    template: "%s · Zulan",
  },
  description:
    "Software de agendamento online para salões de beleza, barbearias e clínicas de estética. Agenda, link de agendamento para clientes, comissões, caixa, estoque e relatórios. Teste grátis por 14 dias, sem cartão.",
  applicationName: "Zulan",
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
  authors: [{ name: "Zulan" }],
  creator: "Zulan",
  publisher: "Zulan",
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
    siteName: "Zulan",
    title: "Zulan — Agendamento online para salões e barbearias",
    description:
      "A cliente agenda pelo seu link, recebe confirmação automática e você só aparece para atender. Agenda, comissões, caixa e estoque. Teste grátis por 14 dias.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zulan — Agendamento online para salões e barbearias",
    description:
      "Menos WhatsApp, mais clientes na cadeira. Agenda online, comissões, caixa e estoque. Teste grátis por 14 dias.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Zulan", statusBarStyle: "default" },
  // Favicon/apple-touch vêm da convenção de arquivos do Next: src/app/icon.png
  // e src/app/apple-icon.png (gerados de icon-zulan.webp por scripts/gen-icons.mjs).
};

export const viewport: Viewport = {
  themeColor: "#0e6f78",
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
    <html lang="pt-BR" className={`${jakarta.variable} ${oswald.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <MotionProvider>{children}</MotionProvider>
        <PWARegister />
      </body>
    </html>
  );
}
