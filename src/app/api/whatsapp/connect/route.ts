import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardWhatsApp } from "@/lib/whatsapp/guard";
import {
  createInstance,
  deleteInstance,
  EvolutionError,
  getConnectionState,
  getQrCode,
  setWebhook,
  type QrCode,
} from "@/lib/whatsapp/evolution";
import { normalizeBrPhone } from "@/lib/whatsapp/phone";

/**
 * Inicia o pareamento: garante a instância na Evolution e devolve o QR code
 * (e o código de pareamento) pro dono usar no WhatsApp dele.
 *
 * A linha em whatsapp_instances nasce aqui com status 'connecting'. Ela só
 * vira 'connected' quando a rota /status confirmar com a Evolution — nunca
 * confiamos que o QR foi mesmo escaneado.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { slug, phone } = body as { slug?: string; phone?: string };

  const guard = await guardWhatsApp(slug ?? "");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { salonId, instanceName } = guard.ctx;

  // Com telefone, o dono pediu o código de pareamento — e o WhatsApp vincula
  // esse código ao número, então ele precisa chegar até a Evolution. Sem
  // número não existe código, só QR.
  let numero: string | null = null;
  if (phone) {
    numero = normalizeBrPhone(phone);
    if (!numero) {
      return NextResponse.json({ error: "telefone_invalido" }, { status: 400 });
    }
  }

  try {
    // O socket do Baileys nasce em modo QR ou em modo código de pareamento e
    // não troca depois. Pedir o código de uma instância que já existe (criada
    // sem número) devolve QR pra sempre — era exatamente o que acontecia.
    // Recriar é o único caminho.
    if (numero) {
      const estado = await getConnectionState(instanceName);
      // Só se pode apagar o que não está pareado. Numa instância conectada
      // isso derrubaria a sessão do salão pra gerar um código que ele nem
      // precisa — quem já está conectado desconecta primeiro, de propósito.
      if (estado === "connected") {
        return NextResponse.json({ error: "ja_conectada" }, { status: 409 });
      }
      await deleteInstance(instanceName);
    }

    // A criação já abre o socket e emite o primeiro código: aproveitá-lo evita
    // a corrida que fazia a segunda instância nascer sem QR. Com número, ela
    // também é o caminho documentado pro código de pareamento.
    // Instância que já existia devolve null na criação; o objeto vazio evita
    // ficar checando null em cada uso daqui pra baixo.
    const vazio: QrCode = { base64: null, pairingCode: null };
    let qr: QrCode = (await createInstance(instanceName, numero)) ?? vazio;

    // Antes do QR chegar ao usuário: assim que o aparelho parear, a instância
    // já está apontada pra nós e a primeira resposta do cliente não se perde.
    let webhookOk = false;
    try {
      webhookOk = await setWebhook(instanceName);
    } catch (e) {
      // Não impede o pareamento — sem webhook o salão ainda envia, só não
      // recebe. A rota /status tenta de novo enquanto webhook_set_at for null.
      console.error("setWebhook falhou", instanceName, (e as Error).message);
    }

    // Instância que já existia não devolve nada na criação; aí sim se pede.
    // Com número, insiste até vir o código — o QR não substitui.
    if (numero ? !qr.pairingCode : !qr.base64 && !qr.pairingCode) {
      qr = await getQrCode(instanceName, { number: numero });
    }

    // Quem pediu código e recebeu só QR precisa ouvir isso. Antes o QR passava
    // pela checagem e a tela voltava sem código e sem explicação — a pessoa
    // clicava de novo achando que não tinha clicado direito.
    if (numero && !qr.pairingCode) {
      console.error("pairingCode ausente", instanceName, "campos:", qr.campos);
      return NextResponse.json(
        { error: "codigo_indisponivel", campos: qr.campos ?? [] },
        { status: 503 },
      );
    }

    if (!qr.base64 && !qr.pairingCode) {
      return NextResponse.json({ error: "qr_indisponivel" }, { status: 503 });
    }

    const admin = createAdminClient();
    await admin.from("whatsapp_instances").upsert(
      {
        salon_id: salonId,
        instance_name: instanceName,
        status: "connecting",
        paused_at: null,
        paused_reason: null,
        failure_count: 0,
        webhook_set_at: webhookOk ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "salon_id" },
    );

    return NextResponse.json({ qrCode: qr.base64, pairingCode: qr.pairingCode });
  } catch (e) {
    if (e instanceof EvolutionError) {
      // Já pareada: pedir outro QR não resolve, tem que desconectar antes.
      if (e.detail === "instancia_ja_conectada") {
        return NextResponse.json({ error: "ja_conectada" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "falha_ao_conectar", detail: e.message },
        { status: 502 },
      );
    }

    const msg = (e as Error).message;
    if (msg === "evolution_nao_configurada") {
      return NextResponse.json({ error: "evolution_nao_configurada" }, { status: 503 });
    }
    return NextResponse.json({ error: "falha_ao_conectar", detail: msg }, { status: 502 });
  }
}
