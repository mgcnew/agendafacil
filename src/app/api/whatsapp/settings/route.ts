import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardWhatsApp } from "@/lib/whatsapp/guard";
import type { TablesUpdate } from "@/lib/database.types";

/**
 * Liga/desliga cada tipo de mensagem do salão.
 *
 * Desligar não cancela o que já está na fila de propósito: o comprovante sai
 * 30s depois de agendar, e se a pessoa desligar nesse intervalo a cliente já
 * está esperando a confirmação. Vale para o que for enfileirado daqui pra
 * frente — `whatsapp_enqueue` confere estes campos a cada mensagem.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "corpo_invalido" }, { status: 400 });
  }

  const { slug, settings } = body as {
    slug?: string;
    settings?: Record<string, unknown>;
  };

  const guard = await guardWhatsApp(slug ?? "");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // Lista fechada: só estes campos podem ser alterados por aqui. Impede que um
  // corpo malicioso mexa em daily_cap, paused_at ou instance_name.
  const patch: TablesUpdate<"whatsapp_instances"> = { updated_at: new Date().toISOString() };
  const allowed = {
    bookingReceipt: "send_booking_receipt",
    thankYou: "send_thank_you",
    reminderConfirm: "send_reminder_confirm",
    reviewRequest: "send_review_request",
  } as const;

  let touched = false;
  for (const [key, column] of Object.entries(allowed)) {
    const value = settings?.[key];
    if (typeof value === "boolean") {
      patch[column] = value;
      touched = true;
    }
  }
  if (!touched) {
    return NextResponse.json({ error: "nada_para_atualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_instances")
    .update(patch)
    .eq("salon_id", guard.ctx.salonId);

  if (error) {
    return NextResponse.json({ error: "falha_ao_salvar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
