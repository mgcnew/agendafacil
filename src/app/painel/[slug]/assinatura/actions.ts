"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasCancelSubscription,
  asaasCreateCustomer,
  asaasCreateSubscription,
  asaasErrorMessage,
  asaasSubscriptionCheckoutUrl,
  asaasUpdateSubscription,
} from "@/lib/asaas";
import { firstDueDate } from "@/lib/asaasBilling";
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

  if (sub.status === "active") {
    return { error: "A assinatura já está ativa. Para trocar de plano, use as opções acima." };
  }

  try {
    let customerId = sub.asaas_customer_id;
    let subscriptionId = sub.asaas_subscription_id;
    const now = new Date().toISOString();

    if (!customerId) {
      const customer = await asaasCreateCustomer({
        name: salon.name,
        email: salon.email,
        mobilePhone: salon.phone,
        cpfCnpj: digits,
        externalReference: salon.id,
      });
      customerId = customer.id;
      // Grava já: se a assinatura falhar logo abaixo, a próxima tentativa
      // reaproveita o cliente em vez de criar um duplicado no Asaas.
      await admin
        .from("salon_subscriptions")
        .update({ asaas_customer_id: customerId, updated_at: now })
        .eq("salon_id", salon.id);
    }

    // Sem assinatura (nunca assinou, ou cancelou — o cancelamento limpa o id):
    // cria uma nova. Pendente ou vencida, reaproveita a mesma (é a cobrança em
    // aberto que ela precisa pagar) e só ajusta o valor se trocou de plano.
    if (!subscriptionId) {
      const subscription = await asaasCreateSubscription({
        customer: customerId,
        value,
        nextDueDate: firstDueDate(sub.trial_ends_at, sub.current_period_end),
        description: `Assinatura Zulan — ${salon.name}`,
        externalReference: salon.id,
      });
      subscriptionId = subscription.id;
    } else if (sub.plan !== planId || Number(sub.value) !== value) {
      await asaasUpdateSubscription(subscriptionId, value);
    }

    await admin
      .from("salon_subscriptions")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        plan: planId,
        value,
        pending_plan: null,
        updated_at: now,
      })
      .eq("salon_id", salon.id);

    const url = await asaasSubscriptionCheckoutUrl(subscriptionId);
    if (!url) return { error: "Não foi possível gerar a página de pagamento." };
    return { url };
  } catch (e) {
    return {
      error: asaasErrorMessage(e, "Não conseguimos falar com o sistema de pagamento. Tente de novo em instantes."),
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
    return { error: asaasErrorMessage(e, "Não conseguimos mudar o plano agora. Tente de novo em instantes.") };
  }
}

export type CancelResult = { ok: true; accessUntil: string | null } | { error: string };

/**
 * Cancela a assinatura (só o dono). Para de cobrar no Asaas na hora, mas o
 * salão segue com acesso até o fim do período já pago — é o que "cancele
 * quando quiser" promete. Reassinar depois cria uma assinatura nova.
 */
export async function cancelSubscription(slug: string): Promise<CancelResult> {
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
    return { error: "Apenas o dono do salão pode cancelar a assinatura." };
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("salon_subscriptions")
    .select("*")
    .eq("salon_id", salon.id)
    .single();
  if (!sub) return { error: "Assinatura do salão não encontrada." };
  if (sub.status !== "active" || !sub.asaas_subscription_id) {
    return { error: "Não há assinatura ativa para cancelar." };
  }

  try {
    await asaasCancelSubscription(sub.asaas_subscription_id);
  } catch (e) {
    return { error: asaasErrorMessage(e, "Não conseguimos cancelar agora. Tente de novo em instantes.") };
  }

  await admin
    .from("salon_subscriptions")
    .update({
      status: "canceled",
      pending_plan: null,
      // A assinatura apagada no Asaas não volta: reassinar cria outra.
      asaas_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("salon_id", salon.id);

  const end = sub.current_period_end;
  return { ok: true, accessUntil: end && new Date(end) > new Date() ? end : null };
}
