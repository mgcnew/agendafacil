"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";

/**
 * "Já conheço o sistema" — esconde o checklist de Primeiros passos de vez.
 * Só o dono decide isso; grava a data em salons.onboarding_done_at.
 */
export async function dismissOnboarding(slug: string): Promise<void> {
  const membership = await getMembershipBySlug(slug);
  if (!membership || membership.role !== "owner") return;

  // Cliente genérico p/ a coluna nova, sem depender de regenerar database.types.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  await supabase
    .from("salons")
    .update({ onboarding_done_at: new Date().toISOString() })
    .eq("id", membership.salon_id);
}
