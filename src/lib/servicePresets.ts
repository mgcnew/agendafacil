import type { Niche } from "@/lib/themes";

export interface ServicePreset {
  name: string;
  /** duração sugerida em minutos (a dona ajusta depois) */
  duration: number;
  /** agrupador para exibição no seletor */
  category: string;
}

/**
 * Serviços comuns por nicho — usados como atalho para popular o catálogo
 * (no onboarding e na página Serviços). Preço fica a cargo do salão.
 */
export const SERVICE_PRESETS: Record<Niche, ServicePreset[]> = {
  feminino: [
    { name: "Corte feminino", duration: 60, category: "Cabelo" },
    { name: "Escova", duration: 45, category: "Cabelo" },
    { name: "Hidratação", duration: 60, category: "Cabelo" },
    { name: "Coloração", duration: 120, category: "Cabelo" },
    { name: "Luzes / Mechas", duration: 180, category: "Cabelo" },
    { name: "Progressiva", duration: 180, category: "Cabelo" },
    { name: "Penteado", duration: 60, category: "Cabelo" },
    { name: "Manicure", duration: 40, category: "Unhas" },
    { name: "Pedicure", duration: 50, category: "Unhas" },
    { name: "Esmaltação em gel", duration: 60, category: "Unhas" },
    { name: "Alongamento de unhas", duration: 90, category: "Unhas" },
    { name: "Design de sobrancelha", duration: 30, category: "Estética" },
    { name: "Depilação buço", duration: 15, category: "Estética" },
    { name: "Maquiagem", duration: 60, category: "Estética" },
    { name: "Limpeza de pele", duration: 60, category: "Estética" },
  ],
  barbearia: [
    { name: "Corte masculino", duration: 40, category: "Cabelo" },
    { name: "Corte infantil", duration: 30, category: "Cabelo" },
    { name: "Platinado", duration: 120, category: "Cabelo" },
    { name: "Barba", duration: 30, category: "Barba" },
    { name: "Corte + Barba", duration: 60, category: "Barba" },
    { name: "Pigmentação de barba", duration: 45, category: "Barba" },
    { name: "Pézinho / Acabamento", duration: 15, category: "Acabamento" },
    { name: "Sobrancelha", duration: 15, category: "Acabamento" },
    { name: "Hidratação capilar", duration: 30, category: "Tratamentos" },
  ],
  estetica: [
    { name: "Limpeza de pele", duration: 60, category: "Pele" },
    { name: "Peeling", duration: 45, category: "Pele" },
    { name: "Design de sobrancelha", duration: 30, category: "Sobrancelha & Cílios" },
    { name: "Henna", duration: 40, category: "Sobrancelha & Cílios" },
    { name: "Extensão de cílios", duration: 90, category: "Sobrancelha & Cílios" },
    { name: "Manicure", duration: 40, category: "Unhas" },
    { name: "Pedicure", duration: 50, category: "Unhas" },
    { name: "Alongamento de unhas", duration: 90, category: "Unhas" },
    { name: "Depilação", duration: 30, category: "Corpo" },
    { name: "Massagem relaxante", duration: 60, category: "Corpo" },
  ],
  neutro: [
    { name: "Corte", duration: 40, category: "Cabelo" },
    { name: "Barba", duration: 30, category: "Cabelo" },
    { name: "Manicure", duration: 40, category: "Unhas" },
    { name: "Pedicure", duration: 50, category: "Unhas" },
    { name: "Design de sobrancelha", duration: 30, category: "Estética" },
    { name: "Limpeza de pele", duration: 60, category: "Estética" },
  ],
};
