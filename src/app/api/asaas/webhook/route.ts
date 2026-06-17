import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/database.types";

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
  // Quando confirma/recebe, estende o período pago até o vencimento da cobrança.
  if (next === "active" && payment?.dueDate) {
    update.current_period_end = new Date(payment.dueDate).toISOString();
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
