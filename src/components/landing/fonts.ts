import localFont from "next/font/local";

// Fonte da landing — geométrica e arredondada, conversa com o desenho do logo.
// Fica só nas páginas de marketing (classe .zl); o painel segue com a Jakarta.
// Arquivo local (versão latina e variável do Google Fonts): ver o porquê em
// app/layout.tsx.
export const figtree = localFont({
  src: "../../app/fonts/figtree-latin.woff2",
  weight: "400 800",
  variable: "--font-figtree",
  display: "swap",
});
