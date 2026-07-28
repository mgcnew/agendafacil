import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardWhatsApp } from "@/lib/whatsapp/guard";
import { logoutInstance } from "@/lib/whatsapp/evolution";

/**
 * Desconecta o aparelho do salão. Faz logout na Evolution (mantendo a
 * instância, pra reparear depois sem recriar) e marca desconectado no banco —
 * o que já basta pro worker parar de enviar, porque whatsapp_claim_next só
 * pega mensagem de instância 'connected'.
 *
 * A fila pendente é descartada de propósito: mensagem que ficaria dias parada
 * chega fora de contexto e é justamente o tipo de coisa que faz o cliente
 * bloquear o número.
 */
export async function POST(req: Request) {
  const { slug } = await req.json().catch(() => ({ slug: "" }));

  const guard = await guardWhatsApp(slug);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { salonId, instanceName } = guard.ctx;

  try {
    await logoutInstance(instanceName);
  } catch (e) {
    // Evolution indisponível não impede desligar do nosso lado — e desligar
    // aqui é o que efetivamente para os envios.
    console.error("whatsapp_logout_falhou", (e as Error).message);
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  await admin
    .from("whatsapp_instances")
    .update({ status: "disconnected", connected_at: null, updated_at: now })
    .eq("salon_id", salonId);

  await admin
    .from("whatsapp_outbox")
    .update({ status: "skipped", skip_reason: "whatsapp_desconectado", updated_at: now })
    .eq("salon_id", salonId)
    .eq("status", "queued");

  return NextResponse.json({ ok: true });
}
