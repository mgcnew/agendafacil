import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardWhatsApp } from "@/lib/whatsapp/guard";
import { getConnectionState } from "@/lib/whatsapp/evolution";

/**
 * Estado da conexão. A Evolution é a fonte da verdade (o aparelho pode ter
 * desconectado sozinho — sem bateria, WhatsApp desvinculado, sessão expirada),
 * então consultamos ela e sincronizamos o banco.
 *
 * Também é o que a tela do painel chama em loop enquanto o QR está aberto.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";

  const guard = await guardWhatsApp(slug);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { salonId, instanceName } = guard.ctx;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("whatsapp_instances")
    .select("*")
    .eq("salon_id", salonId)
    .maybeSingle();

  // Nunca conectou: nada a sincronizar.
  if (!row) {
    return NextResponse.json({ state: "disconnected", configured: false });
  }

  // Pausada pelo circuit breaker: não sobrescreve com o estado da Evolution,
  // senão o worker voltaria a tentar num número que está dando erro.
  if (row.paused_at) {
    return NextResponse.json({
      state: "paused",
      configured: true,
      pausedReason: row.paused_reason,
      lastError: row.last_error,
      settings: pickSettings(row),
    });
  }

  let state: string;
  try {
    state = await getConnectionState(instanceName);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "evolution_nao_configurada") {
      return NextResponse.json({ error: "evolution_nao_configurada" }, { status: 503 });
    }
    // Evolution fora do ar: reporta o último estado conhecido em vez de mentir.
    return NextResponse.json({
      state: row.status,
      configured: true,
      stale: true,
      settings: pickSettings(row),
    });
  }

  if (state !== row.status) {
    const patch: Record<string, unknown> = { status: state, updated_at: new Date().toISOString() };

    if (state === "connected") {
      patch.connected_at = new Date().toISOString();
      patch.failure_count = 0;
      patch.last_error = null;
      // Primeira conexão dispara o ramp-up: o número começa devagar (20/dia)
      // e sobe ao longo de 14 dias. Só na primeira — reconectar não zera.
      if (!row.ramp_started_at) patch.ramp_started_at = new Date().toISOString();
    }

    await admin.from("whatsapp_instances").update(patch).eq("salon_id", salonId);
  }

  return NextResponse.json({
    state,
    configured: true,
    phoneNumber: row.phone_number,
    settings: pickSettings(row),
  });
}

function pickSettings(row: {
  send_booking_receipt: boolean;
  send_thank_you: boolean;
  send_reminder_confirm: boolean;
  send_review_request: boolean;
}) {
  return {
    bookingReceipt: row.send_booking_receipt,
    thankYou: row.send_thank_you,
    reminderConfirm: row.send_reminder_confirm,
    reviewRequest: row.send_review_request,
  };
}
