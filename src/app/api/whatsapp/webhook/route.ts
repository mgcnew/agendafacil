import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEvolutionWebhook } from "@/lib/whatsapp/inbound";

/**
 * Recebe as mensagens que os clientes mandam de volta.
 *
 * Existe primeiro por causa de uma promessa: toda mensagem que enviamos
 * termina com "Responda SAIR para não receber mais mensagens". Sem esta rota a
 * frase era mentira — e quem responde SAIR e continua recebendo Bloqueia, que
 * é justamente o sinal que mais derruba número no WhatsApp. A frase existia
 * pra evitar bloqueio e, sem canal de entrada, produzia bloqueio.
 *
 * Aqui só se confere quem chamou e se repassa. Quem lê o envelope é
 * `parseEvolutionWebhook`; quem interpreta e age é `whatsapp_handle_inbound`,
 * no banco, junto com o resto da regra.
 */

/** Comparação em tempo constante — não entrega o segredo byte a byte. */
function secretOk(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  // Lido por requisição, não no escopo do módulo: é o que os docs do Next
  // chamam de leitura em runtime, e sobrevive a trocar a variável sem rebuild.
  //
  // A Evolution não assina o corpo do webhook, então o segredo vai num header
  // que configuramos junto com a URL (ver setWebhook em lib/whatsapp/evolution).
  const expected = process.env.WHATSAPP_INBOUND_SECRET;

  // Distinto do 401 de propósito: sem esta separação, "faltou configurar a
  // variável" e "o segredo veio errado" respondiam a mesma coisa, e não havia
  // como saber qual dos dois estava acontecendo sem acesso ao servidor.
  if (!expected) {
    console.error("WHATSAPP_INBOUND_SECRET ausente no ambiente");
    return NextResponse.json({ error: "webhook_nao_configurado" }, { status: 503 });
  }

  if (!secretOk(expected, req.headers.get("x-zulan-webhook-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const { instance, messages } = parseEvolutionWebhook(payload);

  // 200 no que a gente decidiu ignorar: a Evolution reentrega em erro, e
  // reentregar algo que nunca vamos processar só gera ruído.
  if (!instance || messages.length === 0) {
    return NextResponse.json({ ok: true, processadas: 0 });
  }

  const admin = createAdminClient();

  for (const m of messages) {
    const { error } = await admin.rpc("whatsapp_handle_inbound", {
      p_instance_name: instance,
      p_phone_raw: m.phone,
      p_body: m.text,
      // undefined em vez de null: omitido, o Postgres usa o default. É o caso
      // raro de vir sem id, em que a dedupe não tem como valer.
      p_provider_message_id: m.providerMessageId ?? undefined,
    });

    if (error) {
      // 500 de propósito: a falha foi nossa, e a reentrega da Evolution é a
      // segunda chance. O unique de provider_message_id garante que
      // reprocessar não age duas vezes.
      console.error("whatsapp_handle_inbound falhou", error.message);
      return NextResponse.json({ error: "falha_ao_processar" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, processadas: messages.length });
}
