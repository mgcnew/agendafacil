import type { Enums } from "@/lib/database.types";

export type Niche = Enums<"salon_niche">;

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

export const NICHES: Record<Niche, NicheMeta> = {
  feminino: {
    id: "feminino",
    label: "Salão Feminino",
    tagline: "Beleza & sofisticação",
    description:
      "Cabelo, coloração, escova, manicure e tratamentos — visual de atelier elegante, com serifa refinada e dourado.",
    gradient: "linear-gradient(135deg, #8e3b5e 0%, #b98a2e 100%)",
    swatch: "#8e3b5e",
    pattern: "grain",
    fontLabel: "Cormorant · Jost",
    examples: ["Corte & Escova", "Coloração", "Manicure", "Hidratação"],
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
    label: "Neutro / Personalizado",
    tagline: "A sua marca",
    description:
      "Tema base moderno e versátil — teal e menta, tipografia grotesque — para qualquer negócio de beleza.",
    gradient: "linear-gradient(135deg, #0e7a6e 0%, #14b8a6 100%)",
    swatch: "#0e7a6e",
    pattern: "grain",
    fontLabel: "Bricolage · Hanken",
    examples: ["Serviços diversos", "Pacotes", "Combos"],
  },
};

export const NICHE_LIST = [
  NICHES.feminino,
  NICHES.barbearia,
  NICHES.estetica,
  NICHES.neutro,
];

export function nicheLabel(n: Niche): string {
  return NICHES[n].label;
}

export function patternClass(p: NicheMeta["pattern"]): string {
  return p === "stripes" ? "af-stripes" : p === "mesh" ? "af-mesh" : "af-grain";
}
