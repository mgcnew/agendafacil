"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";
import { collectSignals } from "@/lib/signals/collect";
import { todayBR } from "@/lib/signals/dismissals";
import type { SignalKey } from "@/lib/signals/types";
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

/**
 * "Entendido, esconder por hoje" num card do Gestor — dispensa a categoria até
 * amanhã (data BR). Reaparece sozinho no dia seguinte se a situação persistir.
 */
export async function dismissGestorSignal(slug: string, signalKey: SignalKey): Promise<void> {
  const membership = await getMembershipBySlug(slug);
  if (!membership) return;

  // Cliente genérico (sem os tipos gerados) para a tabela nova, mesmo padrão do
  // ai_dashboard_insights — evita depender de regenerar database.types.ts.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  await supabase
    .from("gestor_dismissals")
    .upsert(
      { salon_id: membership.salon_id, signal_key: signalKey, dismissed_on: todayBR() },
      { onConflict: "salon_id,signal_key" },
    );
}
