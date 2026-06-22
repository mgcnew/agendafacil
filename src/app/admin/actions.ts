"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasListSubscriptionPayments, type AsaasPayment } from "@/lib/asaas";

export type BillingResult =
  | { ok: true; payments: AsaasPayment[] }
  | { ok: false; error: string };

/**
 * Cobranças (faturas) de um salão no Asaas. Só admins da plataforma.
 * Verifica is_platform_admin() antes de usar o cliente service-role.
 */
export async function getSalonBilling(salonId: string): Promise<BillingResult> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin" as never);
  if (!isAdmin) return { ok: false, error: "Não autorizado." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("salon_subscriptions")
    .select("asaas_subscription_id")
    .eq("salon_id", salonId)
    .maybeSingle();

  const subId = (sub as { asaas_subscription_id: string | null } | null)?.asaas_subscription_id;
  if (!subId) return { ok: false, error: "Salão ainda não tem assinatura no Asaas (sem cobranças)." };

  try {
    const payments = await asaasListSubscriptionPayments(subId);
    return { ok: true, payments };
  } catch {
    return { ok: false, error: "Não foi possível consultar o Asaas agora." };
  }
}
