import type { Enums } from "@/lib/database.types";

export type Niche = Enums<"salon_niche">;
export type ColorTheme = "a" | "b" | "c" | "d";

export interface NicheMeta {
  id: Niche;
  label: string;
  tagline: string;
  description: string;
  /** gradiente usado em cards/hero */
  gradient: string;
  /** cor de destaque para preview (hex) */
  swatch: string;
  /** textura característica do nicho */
  pattern: "grain" | "stripes" | "mesh";
  /** rótulo da personalidade tipográfica */
  fontLabel: string;
  examples: string[];
}

export interface ColorVariant {
  id: ColorTheme;
  label: string;
  /** cor primária para preview */
  primary: string;
  /** fundo claro para preview */
  background: string;
}

export const NICHES: Record<Niche, NicheMeta> = {
  feminino: {
    id: "feminino",
    label: "Salão de Beleza",
    tagline: "Cabelo, estética & bem-estar",
    description:
      "Corte, coloração, escova, manicure, estética e todos os serviços encontrados num salão completo — visual elegante com serifa refinada.",
    gradient: "linear-gradient(135deg, #8e3b5e 0%, #b98a2e 100%)",
    swatch: "#8e3b5e",
    pattern: "grain",
    fontLabel: "Cormorant · Jost",
    examples: ["Corte & Escova", "Coloração", "Manicure", "Estética"],
  },
  barbearia: {
    id: "barbearia",
    label: "Barbearia",
    tagline: "Estilo & atitude",
    description:
      "Corte, barba e navalha com identidade de oficina industrial: fundo escuro, cobre e tipografia condensada.",
    gradient: "linear-gradient(135deg, #c8852f 0%, #9e3b2e 100%)",
    swatch: "#c8852f",
    pattern: "stripes",
    fontLabel: "Oswald · Hanken",
    examples: ["Corte Masculino", "Barba", "Navalhado", "Pézinho"],
  },
  estetica: {
    id: "estetica",
    label: "Estética & Unhas",
    tagline: "Cuidado & bem-estar",
    description:
      "Sobrancelha, cílios, unhas e pele num clima de spa botânico: sálvia, terracota e cantos suaves.",
    gradient: "linear-gradient(135deg, #4f7d63 0%, #be8a5e 100%)",
    swatch: "#4f7d63",
    pattern: "mesh",
    fontLabel: "Fraunces · Nunito",
    examples: ["Sobrancelha", "Alongamento de unhas", "Limpeza de pele", "Cílios"],
  },
  neutro: {
    id: "neutro",
    label: "Neutro",
    tagline: "A sua marca",
    description:
      "Tema base moderno e versátil — laranja e quente — para qualquer negócio de beleza.",
    gradient: "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)",
    swatch: "#ea580c",
    pattern: "grain",
    fontLabel: "Bricolage · Hanken",
    examples: ["Serviços diversos", "Pacotes", "Combos"],
  },
};

/** 4 variantes de cor para cada nicho — somente paletas que fazem sentido para o segmento */
export const NICHE_COLOR_THEMES: Record<Niche, ColorVariant[]> = {
  feminino: [
    { id: "a", label: "Rosa Gold",    primary: "#8e3b5e", background: "#fbf6f4" },
    { id: "b", label: "Berry",        primary: "#9c2580", background: "#faf5fb" },
    { id: "c", label: "Champagne",    primary: "#b5832a", background: "#fdf8f0" },
    { id: "d", label: "Lilás",        primary: "#7c57b8", background: "#f8f5fc" },
  ],
  barbearia: [
    { id: "a", label: "Cobre",        primary: "#c8852f", background: "#15120f" },
    { id: "b", label: "Midnight",     primary: "#3b7ab5", background: "#0d1218" },
    { id: "c", label: "Forest",       primary: "#2e7a50", background: "#0f1410" },
    { id: "d", label: "Steel",        primary: "#7890b8", background: "#0f1115" },
  ],
  estetica: [
    { id: "a", label: "Sálvia",       primary: "#4f7d63", background: "#f2f5f1" },
    { id: "b", label: "Oceano",       primary: "#2d6ea0", background: "#f0f5f9" },
    { id: "c", label: "Lavanda",      primary: "#7c60b0", background: "#f5f2fb" },
    { id: "d", label: "Argila",       primary: "#b86038", background: "#f7f1eb" },
  ],
  neutro: [
    { id: "a", label: "Laranja",      primary: "#ea580c", background: "#fffbf7" },
    { id: "b", label: "Teal",         primary: "#0e7a6e", background: "#f0fbfa" },
    { id: "c", label: "Índigo",       primary: "#4f46e5", background: "#f5f5ff" },
    { id: "d", label: "Chumbo",       primary: "#374151", background: "#f8f8f7" },
  ],
};

export const NICHE_LIST = [
  NICHES.feminino,
  NICHES.barbearia,
  NICHES.estetica,
  NICHES.neutro,
];

/**
 * Nichos disponíveis para escolha no cadastro/configurações.
 * Apenas Salão de Beleza (feminino) e Barbearia são expostos como opções.
 * Os outros nichos (estetica, neutro) existem internamente mas não são selecionáveis.
 */
export const CHOOSABLE_NICHES: NicheMeta[] = [
  NICHES.feminino,
  NICHES.barbearia,
];

export function nicheLabel(n: Niche): string {
  return NICHES[n].label;
}

export function patternClass(p: NicheMeta["pattern"]): string {
  return p === "stripes" ? "af-stripes" : p === "mesh" ? "af-mesh" : "af-grain";
}

export function colorVariantLabel(niche: Niche, color: ColorTheme): string {
  return NICHE_COLOR_THEMES[niche].find((v) => v.id === color)?.label ?? color.toUpperCase();
}
