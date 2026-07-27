// Worker da fila de WhatsApp. Chamado pelo pg_cron a cada minuto.
//
// Ele NÃO decide o que enviar: pede ao banco (`whatsapp_claim_next`), que
// aplica toda a regra anti-ban — janela de silêncio, teto diário com ramp-up,
// ritmo com jitter, serialização por instância e circuit breaker. Concentrar
// isso no SQL mantém a regra num lugar só e à prova de corrida, mesmo se duas
// execuções se sobrepuserem.
//
// Autenticação: header `x-whatsapp-secret` (Vault ↔ secret da função), mesmo
// padrão do send-push. Publicada com --no-verify-jwt: quem chama é o Postgres.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDriver } from "./drivers.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const secret = req.headers.get("x-whatsapp-secret");
  if (!secret || secret !== Deno.env.get("WHATSAPP_WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let driver;
  try {
    driver = getDriver();
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // O banco devolve no máximo 1 mensagem por salão e já marca como 'sending'.
  const { data: batch, error } = await supabase.rpc("whatsapp_claim_next", { p_max: 20 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!batch || batch.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Instâncias em lote — a fila traz salon_id, o nome vive em outra tabela.
  const salonIds = [...new Set(batch.map((m: { salon_id: string }) => m.salon_id))];
  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("salon_id, instance_name")
    .in("salon_id", salonIds);

  const instanceBySalon = new Map(
    (instances ?? []).map((i: { salon_id: string; instance_name: string }) => [
      i.salon_id,
      i.instance_name,
    ]),
  );

  // Salões diferentes em paralelo (números distintos, sem risco de rajada);
  // dentro do mesmo salão o banco já garantiu uma por vez.
  const results = await Promise.all(
    batch.map(async (msg: {
      id: string;
      salon_id: string;
      phone: string;
      body: string;
    }) => {
      const instanceName = instanceBySalon.get(msg.salon_id);
      if (!instanceName) {
        await supabase.rpc("whatsapp_mark_result", {
          p_id: msg.id,
          p_ok: false,
          p_error: "instancia_nao_encontrada",
        });
        return false;
      }

      const res = await driver.send({ instanceName, phone: msg.phone, body: msg.body });

      if (res.ok) {
        await supabase.rpc("whatsapp_mark_result", {
          p_id: msg.id,
          p_ok: true,
          p_provider_message_id: res.providerMessageId,
        });
        return true;
      }

      // Erro fatal (número sem WhatsApp) não merece retry: marca como
      // descartada em vez de gastar as 4 tentativas e sujar o breaker.
      if (res.fatal) {
        await supabase
          .from("whatsapp_outbox")
          .update({ status: "skipped", skip_reason: res.error, updated_at: new Date().toISOString() })
          .eq("id", msg.id);
        return false;
      }

      await supabase.rpc("whatsapp_mark_result", {
        p_id: msg.id,
        p_ok: false,
        p_error: res.error,
      });
      return false;
    }),
  );

  return new Response(
    JSON.stringify({ claimed: batch.length, sent: results.filter(Boolean).length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
