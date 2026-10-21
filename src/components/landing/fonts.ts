import { Figtree } from "next/font/google";

// Fonte da landing — geométrica e arredondada, conversa com o desenho do logo.
// Fica só nas páginas de marketing (classe .zl); o painel segue com a Jakarta.
export const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
