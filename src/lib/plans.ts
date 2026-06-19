export type PlanId = "basic" | "pro" | "max";

export type Plan = {
  id: PlanId;
  name: string;
  value: number; // R$ por mês
  tagline: string;
  comingSoon?: boolean; // true = exibido mas não assinável
};

/** Catálogo de planos. Valores cobrados no Asaas vêm daqui (não de env). */
export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: "basic",
    name: "Básico",
    value: 39.9,
    tagline: "Só agendamento — agenda, clientes, serviços e equipe.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    value: 69.9,
    tagline: "Tudo: caixa, comissões, estoque, pacotes, campanhas e relatórios.",
  },
  max: {
    id: "max",
    name: "Max",
    value: 99.9,
    tagline: "Tudo do Pro + integração com WhatsApp.",
    comingSoon: true,
  },
};

/** Planos que o usuário pode efetivamente assinar agora (exclui os "em breve"). */
export const SUBSCRIBABLE_PLANS: Plan[] = Object.values(PLANS).filter(
  (p) => !p.comingSoon,
);

/** Rotas do painel exclusivas do Pro/Max (bloqueadas no Básico). */
export const PRO_ONLY_HREFS = [
  "/campanhas",
  "/pacotes",
  "/financeiro",
  "/relatorios",
  "/estoque",
] as const;

/**
 * Rotas exclusivas do Max (bloqueadas no Básico e no Pro).
 * TODO(lançamento Divulgação): mover "/marketing" para cá quando a IA estiver
 * ligada. Por ora a página fica acessível a todos os planos para desenvolvimento.
 */
export const MAX_ONLY_HREFS = [] as const;

/** O plano efetivo libera a rota? Básico só acessa o que não é PRO/MAX-only. */
export function planAllowsHref(
  effectivePlan: PlanId | null,
  href: string,
): boolean {
  if (!effectivePlan) return false;
  if (MAX_ONLY_HREFS.includes(href as (typeof MAX_ONLY_HREFS)[number])) {
    return effectivePlan === "max";
  }
  if (!PRO_ONLY_HREFS.includes(href as (typeof PRO_ONLY_HREFS)[number])) {
    return true;
  }
  return effectivePlan === "pro" || effectivePlan === "max";
}

const RANK: Record<PlanId, number> = { basic: 1, pro: 2, max: 3 };

/** Posição do plano (basic < pro < max). Use para decidir upgrade vs downgrade. */
export function planRank(p: PlanId): number {
  return RANK[p];
}

export function priceLabel(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
