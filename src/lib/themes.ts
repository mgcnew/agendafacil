import type { Enums } from "@/lib/database.types";

export type Niche = Enums<"salon_niche">;
export type ColorTheme =
  | "a" | "b" | "c" | "d" // Pastel
  | "e" | "f" | "g" | "h" // Vibrante
  | "i" | "j" | "k" | "l"; // Sólido

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
  /** fundo do tema para preview */
  background: string;
  /** cor de destaque para preview */
  accent: string;
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
    gradient: "linear-gradient(135deg, #f23c10 0%, #ffa504 100%)",
    swatch: "#f23c10",
    pattern: "grain",
    fontLabel: "Bricolage · Hanken",
    examples: ["Serviços diversos", "Pacotes", "Combos"],
  },
};

/** Grupo de paletas de cor (compartilhado entre todos os nichos). */
export interface ColorGroup {
  id: string;
  label: string;
  description: string;
  variants: ColorVariant[];
}

/**
 * 12 paletas compartilhadas, em 3 grupos. O nicho define tipografia/forma;
 * a cor é a mesma opção para qualquer segmento. As paletas trazem só os
 * valores de preview — os tokens completos vivem em globals.css via
 * `[data-color="<id>"]`. As cores antigas (a–d) seguem válidas no grupo Pastel.
 */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    id: "pastel",
    label: "Pastel",
    description: "Tons suaves e elegantes, fundo claro.",
    variants: [
      { id: "a", label: "Rosa Gold", primary: "#8e3b5e", background: "#fbf6f4", accent: "#b98a2e" },
      { id: "b", label: "Lilás",     primary: "#7c57b8", background: "#f8f5fc", accent: "#c78ec0" },
      { id: "c", label: "Sálvia",    primary: "#4f7d63", background: "#f2f5f1", accent: "#be8a5e" },
      { id: "d", label: "Champagne", primary: "#b5832a", background: "#fdf8f0", accent: "#8e3b5e" },
    ],
  },
  {
    id: "vibrante",
    label: "Vibrante",
    description: "Cores saturadas e cheias de energia.",
    variants: [
      { id: "e", label: "Laranja", primary: "#f23c10", background: "#fffbf7", accent: "#ffa504" },
      { id: "f", label: "Pink",    primary: "#db2777", background: "#fdf2f8", accent: "#f59e0b" },
      { id: "g", label: "Roxo",    primary: "#7c3aed", background: "#f6f3ff", accent: "#ec4899" },
      { id: "h", label: "Ciano",   primary: "#0891b2", background: "#eefdfd", accent: "#f97316" },
    ],
  },
  {
    id: "solido",
    label: "Sólido",
    description: "Cores fortes e marcantes, incluindo preto.",
    variants: [
      { id: "i", label: "Preto",     primary: "#f5f5f5", background: "#161616", accent: "#e7b96a" },
      { id: "j", label: "Marinho",   primary: "#1e3a8a", background: "#f4f6fb", accent: "#d4a24e" },
      { id: "k", label: "Esmeralda", primary: "#047857", background: "#f0faf5", accent: "#ca8a04" },
      { id: "l", label: "Bordô",     primary: "#9f1239", background: "#fcf3f4", accent: "#b5832a" },
    ],
  },
];

/** Lista plana de todas as variantes (para lookups por id). */
export const ALL_COLOR_VARIANTS: ColorVariant[] = COLOR_GROUPS.flatMap(
  (g) => g.variants,
);

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

export function colorVariantLabel(color: ColorTheme): string {
  return ALL_COLOR_VARIANTS.find((v) => v.id === color)?.label ?? color.toUpperCase();
}
