import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  Cormorant_Garamond,
  Oswald,
  Fraunces,
  Bricolage_Grotesque,
  Jost,
  Nunito_Sans,
} from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";

// Corpo base
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], display: "swap" });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], display: "swap" });
const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"], display: "swap" });

// Display por nicho
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "AgendeFácil — Agendamento para salões e barbearias",
  description:
    "Sistema completo de agendamento, equipe, comissões, caixa e estoque para salões de beleza, barbearias e estética.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AgendeFácil", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0e7a6e",
  width: "device-width",
  initialScale: 1,
};

const fontVars = [
  hanken.variable,
  jost.variable,
  nunito.variable,
  cormorant.variable,
  oswald.variable,
  fraunces.variable,
  bricolage.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fontVars} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
