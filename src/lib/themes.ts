import type { Enums } from "@/lib/database.types";

export type Niche = Enums<"salon_niche">;

export interface NicheMeta {
  id: Niche;
  label: string;
  tagline: string;
  description: string;
  /** gradiente usado em cards/hero da landing */
  gradient: string;
  /** cor de destaque para preview (hex) */
  swatch: string;
  examples: string[];
}

export const NICHES: Record<Niche, NicheMeta> = {
  feminino: {
    id: "feminino",
    label: "Salão Feminino",
    tagline: "Beleza & sofisticação",
    description:
      "Cabelo, coloração, escova, manicure e tratamentos — um visual elegante e acolhedor para o seu salão.",
    gradient: "linear-gradient(135deg, #9d4e6c 0%, #c2973f 100%)",
    swatch: "#9d4e6c",
    examples: ["Corte & Escova", "Coloração", "Manicure", "Hidratação"],
  },
  barbearia: {
    id: "barbearia",
    label: "Barbearia",
    tagline: "Estilo & atitude",
    description:
      "Corte, barba, navalha e cuidados masculinos com uma identidade visual forte e industrial.",
    gradient: "linear-gradient(135deg, #c8852f 0%, #6b3e12 100%)",
    swatch: "#c8852f",
    examples: ["Corte Masculino", "Barba", "Navalhado", "Pézinho"],
  },
  estetica: {
    id: "estetica",
    label: "Estética & Unhas",
    tagline: "Cuidado & bem-estar",
    description:
      "Sobrancelha, cílios, design de unhas, limpeza de pele e estética — um clima clean e relaxante.",
    gradient: "linear-gradient(135deg, #5b8a72 0%, #c2a878 100%)",
    swatch: "#5b8a72",
    examples: ["Sobrancelha", "Alongamento de unhas", "Limpeza de pele", "Cílios"],
  },
  neutro: {
    id: "neutro",
    label: "Neutro / Personalizado",
    tagline: "A sua marca",
    description:
      "Um tema base elegante e versátil para qualquer tipo de negócio de beleza.",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    swatch: "#0f766e",
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
