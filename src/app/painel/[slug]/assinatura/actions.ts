"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasCreateCustomer,
  asaasCreateSubscription,
  asaasSubscriptionCheckoutUrl,
} from "@/lib/asaas";
import { PLANS, type PlanId } from "@/lib/plans";

export type CheckoutResult = { url: string } | { error: string };

/**
 * Cria (ou reaproveita) a assinatura do salão no Asaas e devolve a URL da página
 * de pagamento hospedada. Só o DONO do salão pode assinar.
 */
export async function createCheckout(
  slug: string,
  planId: PlanId,
  cpfCnpj: string,
): Promise<CheckoutResult> {
  const plan = PLANS[planId];
  if (!plan || plan.comingSoon) {
    return { error: "Plano indisponível." };
  }

  const digits = (cpfCnpj ?? "").replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) {
    return { error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "Não autenticado." };

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, email, phone, owner_id")
    .eq("slug", slug)
    .single();
  if (!salon || salon.owner_id !== uid) {
    return { error: "Apenas o dono do salão pode assinar." };
  }

  const value = plan.value;

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("salon_subscriptions")
    .select("*")
    .eq("salon_id", salon.id)
    .single();
  if (!sub) return { error: "Assinatura do salão não encontrada." };

  try {
    let customerId = sub.asaas_customer_id;
    let subscriptionId = sub.asaas_subscription_id;

    if (!subscriptionId) {
      if (!customerId) {
        const customer = await asaasCreateCustomer({
          name: salon.name,
          email: salon.email,
          mobilePhone: salon.phone,
          cpfCnpj: digits,
          externalReference: salon.id,
        });
        customerId = customer.id;
      }
      const subscription = await asaasCreateSubscription({
        customer: customerId,
        value,
        nextDueDate: firstDueDate(sub.trial_ends_at),
        description: `Assinatura AgendeFácil — ${salon.name}`,
        externalReference: salon.id,
      });
      subscriptionId = subscription.id;

      await admin
        .from("salon_subscriptions")
        .update({
          asaas_customer_id: customerId,
          asaas_subscription_id: subscriptionId,
          plan: planId,
          value,
          updated_at: new Date().toISOString(),
        })
        .eq("salon_id", salon.id);
    }

    const url = await asaasSubscriptionCheckoutUrl(subscriptionId);
    if (!url) return { error: "Não foi possível gerar a página de pagamento." };
    return { url };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erro ao criar a assinatura.",
    };
  }
}

/** Primeira data de cobrança: fim do trial (se futuro) ou amanhã. Formato YYYY-MM-DD. */
function firstDueDate(trialEndsAt: string): string {
  const trial = new Date(trialEndsAt);
  const now = new Date();
  const due =
    trial > now ? trial : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}
