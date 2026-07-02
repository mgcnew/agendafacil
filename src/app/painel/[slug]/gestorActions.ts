"use server";

import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";
import { collectSignals } from "@/lib/signals/collect";
import { refreshDashboardInsights } from "@/lib/ai/dashboardInsights";

/** Botão "Atualizar" do card do Gestor — ignora o cache do dia e gera de novo. */
export async function refreshGestorInsights(slug: string): Promise<void> {
  const membership = await getMembershipBySlug(slug);
  if (!membership) return;

  const supabase = await createClient();
  const fullName = (membership.display_name ?? "").trim();
  const { context, signals } = await collectSignals(supabase, membership.salon_id, {
    firstName: fullName ? fullName.split(" ")[0] : "",
    salonName: membership.salons.name,
  });

  await refreshDashboardInsights(supabase, membership.salon_id, context, signals);
}
