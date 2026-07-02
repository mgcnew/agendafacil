"use server";

import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";
import { collectSignals } from "@/lib/signals/collect";
import { refreshDashboardInsights } from "@/lib/ai/dashboardInsights";

export type RefreshGestorResult = { blocked: boolean; message?: string };

/** Botão "Analisar de novo" do card do Gestor — ignora o cache do dia e gera de novo. */
export async function refreshGestorInsights(slug: string): Promise<RefreshGestorResult> {
  const membership = await getMembershipBySlug(slug);
  if (!membership) return { blocked: false };

  const supabase = await createClient();
  const fullName = (membership.display_name ?? "").trim();
  const { context, signals } = await collectSignals(supabase, membership.salon_id, {
    firstName: fullName ? fullName.split(" ")[0] : "",
    salonName: membership.salons.name,
  });

  const result = await refreshDashboardInsights(supabase, membership.salon_id, context, signals);
  if (result.blocked) {
    return {
      blocked: true,
      message: "Já dei algumas olhadas hoje — se for urgente me chama direto, senão eu volto a analisar tudo amanhã cedo.",
    };
  }
  return { blocked: false };
}
