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

/**
 * Lê o plano vindo de `?plano=` na URL. O card clicado na landing carrega essa
 * escolha por todo o funil (cadastro → onboarding → checkout), pra quem já
 * decidiu não ter que escolher de novo lá no fim.
 *
 * Devolve null pra qualquer coisa inesperada — inclusive plano "em breve", que
 * não é assinável e não pode virar destino de checkout.
 */
export function parsePlanParam(raw: string | null | undefined): PlanId | null {
  // hasOwn e não `PLANS[raw]`: chaves herdadas do protótipo ("__proto__",
  // "constructor") devolvem objeto truthy e passariam pela checagem, deixando
  // o checkout com um plano inexistente.
  if (!raw || !Object.hasOwn(PLANS, raw)) return null;
  const plan = PLANS[raw as PlanId];
  if (!plan || plan.comingSoon) return null;
  return plan.id;
}

/** Rotas do painel exclusivas do Pro/Max (bloqueadas no Básico). */
export const PRO_ONLY_HREFS = [
  "/campanhas",
  "/recuperar",
  "/pacotes",
  "/financeiro",
  "/relatorios",
  "/estoque",
] as const;

/**
 * Divulgação (artes com IA) está fora do ar.
 *
 * A tela inteira existe — construtor de prompt, formatos, créditos —, mas a
 * geração nunca foi ligada: `/api/marketing/generate` devolve 501 no caminho
 * ao vivo e um SVG "prévia" no outro, e as tabelas `ai_generations` e
 * `ai_credits` nem chegaram a ser criadas. Enquanto a API de imagem não couber
 * no orçamento, mostrar o menu é prometer o que não entrega.
 *
 * Um interruptor só, usado em três lugares: o item do menu (`layout.tsx`), a
 * própria rota e o endpoint de geração. Religar é trocar para `true` — nada
 * foi apagado.
 */
export const DIVULGACAO_DISPONIVEL = false;

/**
 * Rotas exclusivas do Max (bloqueadas no Básico e no Pro).
 * TODO(lançamento Divulgação): mover "/marketing" para cá junto com
 * DIVULGACAO_DISPONIVEL = true.
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

/** Como cada área restrita se chama no menu — usado para explicar o downgrade. */
const HREF_LABEL: Record<string, string> = {
  "/campanhas": "Campanhas",
  "/recuperar": "Recuperar clientes",
  "/pacotes": "Pacotes",
  "/financeiro": "Caixa & Comissões",
  "/relatorios": "Relatórios",
  "/estoque": "Estoque",
  "/marketing": "Divulgação",
};

/**
 * O que se perde ao trocar do plano `from` para o `to`. Vazio quando não é
 * downgrade.
 *
 * Importa porque o salão nasce no trial como "pro" (default da coluna `plan`):
 * a pessoa passa 14 dias usando Caixa e Relatórios e, se assinar o Básico sem
 * aviso, eles simplesmente somem — parece defeito, não regra de plano.
 *
 * A lista é derivada de planAllowsHref, a mesma função que de fato bloqueia as
 * rotas, pra que o aviso nunca divirja do comportamento real.
 */
export function featuresLostDowngrading(from: PlanId, to: PlanId): string[] {
  if (planRank(to) >= planRank(from)) return [];
  const gated: string[] = [...PRO_ONLY_HREFS, ...MAX_ONLY_HREFS];
  return gated
    .filter((href) => planAllowsHref(from, href) && !planAllowsHref(to, href))
    .map((href) => HREF_LABEL[href] ?? href);
}

const RANK: Record<PlanId, number> = { basic: 1, pro: 2, max: 3 };

/** Posição do plano (basic < pro < max). Use para decidir upgrade vs downgrade. */
export function planRank(p: PlanId): number {
  return RANK[p];
}

export function priceLabel(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
