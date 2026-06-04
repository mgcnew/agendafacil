import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  Playfair_Display,
  Oswald,
  Fraunces,
} from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
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
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${hanken.variable} ${playfair.variable} ${oswald.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
