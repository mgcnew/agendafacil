"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasListSubscriptionPayments, type AsaasPayment } from "@/lib/asaas";

export type BillingContact = { name: string; phone: string | null; email: string | null };

export type BillingResult =
  | { ok: true; payments: AsaasPayment[]; contact: BillingContact }
  | { ok: false; error: string };

/**
 * Cobranças (faturas) de um salão no Asaas + contato do dono (para cobrança
 * proativa). Só admins da plataforma — verifica is_platform_admin() antes de
 * usar o cliente service-role.
 */
export async function getSalonBilling(salonId: string): Promise<BillingResult> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin" as never);
  if (!isAdmin) return { ok: false, error: "Não autorizado." };

  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select("name, phone, email, owner_id")
    .eq("id", salonId)
    .maybeSingle();

  let phone = salon?.phone ?? null;
  let email = salon?.email ?? null;
  if (salon?.owner_id) {
    const { data: prof } = await admin
      .from("profiles")
      .select("phone, email")
      .eq("id", salon.owner_id)
      .maybeSingle();
    phone = prof?.phone ?? phone;
    email = prof?.email ?? email;
  }
  const contact: BillingContact = { name: salon?.name ?? "salão", phone, email };

  const { data: sub } = await admin
    .from("salon_subscriptions")
    .select("asaas_subscription_id")
    .eq("salon_id", salonId)
    .maybeSingle();

  const subId = (sub as { asaas_subscription_id: string | null } | null)?.asaas_subscription_id;
  if (!subId) return { ok: false, error: "Salão ainda não tem assinatura no Asaas (sem cobranças)." };

  try {
    const payments = await asaasListSubscriptionPayments(subId);
    return { ok: true, payments, contact };
  } catch {
    return { ok: false, error: "Não foi possível consultar o Asaas agora." };
  }
}
