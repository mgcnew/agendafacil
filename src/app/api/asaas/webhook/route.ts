import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/database.types";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Webhook do Asaas — recebe eventos de cobrança e atualiza salon_subscriptions.
 * Configure no Asaas (Integrações → Webhooks) apontando para:
 *   https://SEU-DOMINIO/api/asaas/webhook
 * e defina o "Token de autenticação" igual a ASAAS_WEBHOOK_TOKEN.
 *
 * Eventos do Asaas são por COBRANÇA (payment), e cada cobrança carrega o id da
 * assinatura em `payment.subscription` — é por ele que casamos com o salão.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expected) {
    const got = req.headers.get("asaas-access-token");
    if (got !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: AsaasWebhookBody;
  try {
    body = (await req.json()) as AsaasWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = body.event;
  const payment = body.payment;
  const subscriptionId = payment?.subscription;

  // Sem assinatura associada → nada a fazer (ex.: cobrança avulsa).
  if (!subscriptionId) return NextResponse.json({ ignored: true });

  const next = statusForEvent(event);
  if (!next) return NextResponse.json({ ignored: true });

  const admin = createAdminClient();
  const update: TablesUpdate<"salon_subscriptions"> = {
    status: next,
    updated_at: new Date().toISOString(),
  };
  if (next === "active") {
    // Estende o período pago até o vencimento da cobrança.
    if (payment?.dueDate) {
      update.current_period_end = new Date(payment.dueDate).toISOString();
    }
    // Aplica o downgrade agendado na renovação (pending_plan -> plan).
    const { data: row } = await admin
      .from("salon_subscriptions")
      .select("pending_plan")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    if (row?.pending_plan) {
      const pp = row.pending_plan as PlanId;
      update.plan = pp;
      update.value = PLANS[pp]?.value ?? null;
      update.pending_plan = null;
    }
  }

  const { error } = await admin
    .from("salon_subscriptions")
    .update(update)
    .eq("asaas_subscription_id", subscriptionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

type AsaasWebhookBody = {
  event?: string;
  payment?: {
    subscription?: string;
    customer?: string;
    status?: string;
    dueDate?: string;
  };
};

/** Mapeia o evento do Asaas para o status interno da assinatura. */
function statusForEvent(
  event?: string,
): "active" | "past_due" | "canceled" | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "active";
    case "PAYMENT_OVERDUE":
      return "past_due";
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return "canceled";
    default:
      return null;
  }
}
