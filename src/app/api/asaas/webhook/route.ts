import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/database.types";
import { PLANS, type PlanId } from "@/lib/plans";
import { asaasCancelSubscription } from "@/lib/asaas";
import {
  isSubscriptionEndedEvent,
  laterPeriodEnd,
  periodEndFromDueDate,
  statusForPaymentEvent,
} from "@/lib/asaasBilling";

/**
 * Webhook do Asaas — recebe eventos de cobrança e atualiza salon_subscriptions.
 * Configure no Asaas (Integrações → Webhooks) apontando para:
 *   https://SEU-DOMINIO/api/asaas/webhook
 * e defina o "Token de autenticação" igual a ASAAS_WEBHOOK_TOKEN.
 *
 * Eventos de COBRANÇA (payment) carregam o id da assinatura em
 * `payment.subscription`; eventos de ASSINATURA, em `subscription.id`. É por
 * esse id que casamos com o salão.
 */
export async function POST(req: NextRequest) {
  // Sem token configurado o endpoint recusa tudo: antes ele aceitava qualquer
  // um, e bastava um POST para "pagar" a assinatura de qualquer salão.
  if (!tokenOk(req.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: AsaasWebhookBody;
  try {
    body = (await req.json()) as AsaasWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = body.event;
  const subscriptionId = body.payment?.subscription ?? body.subscription?.id;

  // Sem assinatura associada → nada a fazer (ex.: cobrança avulsa).
  if (!subscriptionId) return NextResponse.json({ ignored: true });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("salon_subscriptions")
    .select("status, pending_plan, current_period_end")
    .eq("asaas_subscription_id", subscriptionId)
    .maybeSingle();
  if (!row) return NextResponse.json({ ignored: true });

  const now = new Date().toISOString();
  let update: TablesUpdate<"salon_subscriptions"> | null = null;

  if (isSubscriptionEndedEvent(event)) {
    // Assinatura apagada (pelo botão de cancelar ou no painel do Asaas): para
    // de cobrar, mas o período já pago continua valendo até o fim.
    update = { status: "canceled", pending_plan: null, asaas_subscription_id: null, updated_at: now };
  } else {
    const next = statusForPaymentEvent(event);
    if (next === "active") {
      update = { status: "active", updated_at: now };
      if (body.payment?.dueDate) {
        update.current_period_end = laterPeriodEnd(
          row.current_period_end,
          periodEndFromDueDate(body.payment.dueDate),
        );
      }
      // Aplica o downgrade agendado na renovação (pending_plan -> plan).
      if (row.pending_plan) {
        const pp = row.pending_plan as PlanId;
        update.plan = pp;
        update.value = PLANS[pp]?.value ?? null;
        update.pending_plan = null;
      }
    } else if (next === "past_due") {
      // Quem já cancelou não vira "inadimplente" por uma cobrança velha.
      if (row.status !== "canceled") update = { status: "past_due", updated_at: now };
    } else if (next === "canceled") {
      // Estorno/contestação: o dinheiro voltou, então o acesso acaba agora e a
      // assinatura para de gerar cobranças (antes seguia cobrando no Asaas).
      try {
        await asaasCancelSubscription(subscriptionId);
      } catch (e) {
        console.error("[asaas webhook] falha ao cancelar assinatura estornada", e);
      }
      update = {
        status: "canceled",
        current_period_end: now,
        pending_plan: null,
        asaas_subscription_id: null,
        updated_at: now,
      };
    }
  }

  if (!update) return NextResponse.json({ ignored: true });

  const { error } = await admin
    .from("salon_subscriptions")
    .update(update)
    .eq("asaas_subscription_id", subscriptionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function tokenOk(got: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type AsaasWebhookBody = {
  event?: string;
  payment?: {
    subscription?: string;
    customer?: string;
    status?: string;
    dueDate?: string;
  };
  subscription?: {
    id?: string;
  };
};
