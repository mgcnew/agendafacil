"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasCreateCustomer,
  asaasCreateSubscription,
  asaasSubscriptionCheckoutUrl,
  asaasUpdateSubscription,
} from "@/lib/asaas";
import { PLANS, planRank, type PlanId } from "@/lib/plans";

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

export type ChangePlanResult =
  | { ok: true; mode: "upgrade" | "downgrade" | "canceled" }
  | { error: string };

/**
 * Troca de plano de uma assinatura ATIVA (regras de mercado):
 * - Upgrade: vale na hora (muda o plano e o valor da assinatura no Asaas).
 * - Downgrade: agendado para o fim do ciclo (grava pending_plan; a próxima
 *   cobrança já sai no valor menor, e o webhook aplica o plano na renovação).
 * - Selecionar o plano atual quando há downgrade pendente: cancela o agendamento.
 */
export async function changePlan(
  slug: string,
  planId: PlanId,
): Promise<ChangePlanResult> {
  const plan = PLANS[planId];
  if (!plan || plan.comingSoon) return { error: "Plano indisponível." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "Não autenticado." };

  const { data: salon } = await supabase
    .from("salons")
    .select("id, owner_id")
    .eq("slug", slug)
    .single();
  if (!salon || salon.owner_id !== uid) {
    return { error: "Apenas o dono do salão pode mudar o plano." };
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("salon_subscriptions")
    .select("*")
    .eq("salon_id", salon.id)
    .single();
  if (!sub) return { error: "Assinatura do salão não encontrada." };
  if (sub.status !== "active" || !sub.asaas_subscription_id) {
    return { error: "A troca de plano só vale para assinaturas ativas." };
  }

  const current = sub.plan as PlanId;
  const now = new Date().toISOString();

  try {
    // Mesmo plano: cancela um downgrade agendado (volta o valor ao plano atual).
    if (planId === current) {
      if (!sub.pending_plan) return { error: "Esse já é o seu plano atual." };
      await asaasUpdateSubscription(sub.asaas_subscription_id, PLANS[current].value);
      await admin
        .from("salon_subscriptions")
        .update({ pending_plan: null, value: PLANS[current].value, updated_at: now })
        .eq("salon_id", salon.id);
      return { ok: true, mode: "canceled" };
    }

    if (planRank(planId) > planRank(current)) {
      // UPGRADE — imediato.
      await asaasUpdateSubscription(sub.asaas_subscription_id, plan.value);
      await admin
        .from("salon_subscriptions")
        .update({ plan: planId, value: plan.value, pending_plan: null, updated_at: now })
        .eq("salon_id", salon.id);
      return { ok: true, mode: "upgrade" };
    }

    // DOWNGRADE — agendado para a renovação. Próxima cobrança já no valor menor.
    await asaasUpdateSubscription(sub.asaas_subscription_id, plan.value);
    await admin
      .from("salon_subscriptions")
      .update({ pending_plan: planId, updated_at: now })
      .eq("salon_id", salon.id);
    return { ok: true, mode: "downgrade" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao mudar o plano." };
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
