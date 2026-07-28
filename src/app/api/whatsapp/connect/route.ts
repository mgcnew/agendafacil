import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardWhatsApp } from "@/lib/whatsapp/guard";
import { createInstance, getQrCode } from "@/lib/whatsapp/evolution";

/**
 * Inicia o pareamento: garante a instância na Evolution e devolve o QR code
 * pro dono escanear no WhatsApp dele.
 *
 * A linha em whatsapp_instances nasce aqui com status 'connecting'. Ela só
 * vira 'connected' quando a rota /status confirmar com a Evolution — nunca
 * confiamos que o QR foi mesmo escaneado.
 */
export async function POST(req: Request) {
  const { slug } = await req.json().catch(() => ({ slug: "" }));

  const guard = await guardWhatsApp(slug);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { salonId, instanceName } = guard.ctx;

  try {
    await createInstance(instanceName);
    const qr = await getQrCode(instanceName);

    // Admin client: a instância é escrita pelo sistema, não pelo usuário.
    const admin = createAdminClient();
    await admin
      .from("whatsapp_instances")
      .upsert(
        {
          salon_id: salonId,
          instance_name: instanceName,
          status: "connecting",
          paused_at: null,
          paused_reason: null,
          failure_count: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "salon_id" },
      );

    return NextResponse.json({ qrCode: qr.base64, pairingCode: qr.pairingCode });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "evolution_nao_configurada") {
      return NextResponse.json({ error: "evolution_nao_configurada" }, { status: 503 });
    }
    return NextResponse.json({ error: "falha_ao_conectar", detail: msg }, { status: 502 });
  }
}
