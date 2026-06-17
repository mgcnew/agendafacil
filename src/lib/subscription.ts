import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planAllowsHref, type PlanId } from "@/lib/plans";

export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export type AccessStatus = {
  status: SubStatus;
  trial_ends_at: string;
  current_period_end: string | null;
  has_access: boolean;
  plan: PlanId;
  effective_plan: PlanId | null;
  pending_plan: PlanId | null;
};

/**
 * Status de acesso/assinatura do salão para o usuário logado.
 * Usa a função SECURITY DEFINER `salon_access_status` (escopada a membros).
 * Memoizado por request — layout e página compartilham a mesma chamada.
 */
export const getAccessStatus = cache(
  async (slug: string): Promise<AccessStatus | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("salon_access_status", {
      p_slug: slug,
    });
    if (error || !data || data.length === 0) return null;
    return data[0] as AccessStatus;
  },
);

/**
 * Bloqueia o acesso direto (por URL) a uma rota exclusiva de plano superior.
 * Chamar no topo das páginas Pro. Fail-open se o plano não puder ser lido.
 */
export async function guardFeature(slug: string, href: string): Promise<void> {
  const access = await getAccessStatus(slug);
  if (access?.effective_plan && !planAllowsHref(access.effective_plan, href)) {
    redirect(`/painel/${slug}`);
  }
}
