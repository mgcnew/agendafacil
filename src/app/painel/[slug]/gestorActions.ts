"use server";

import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";
import { computeGestorSignals, refreshDashboardInsights } from "@/lib/ai/dashboardInsights";

/** Botão "Atualizar" do card do Gestor — ignora o cache do dia e gera de novo. */
export async function refreshGestorInsights(slug: string): Promise<void> {
  const membership = await getMembershipBySlug(slug);
  if (!membership) return;

  const supabase = await createClient();
  const signals = await computeGestorSignals(supabase, membership.salon_id, {
    profileId: membership.profile_id,
    displayName: membership.display_name ?? "",
    salonName: membership.salons.name,
  });

  await refreshDashboardInsights(supabase, membership.salon_id, signals);
}
