// Recebe o evento do trigger `notify_appointment_event` (appointments) e
// dispara push via FCM HTTP v1 pra todo mundo inscrito naquele salão.
// Autenticação: header `x-push-secret` (compartilhado com o trigger via
// Supabase Vault) — a função roda com --no-verify-jwt porque quem chama é o
// Postgres, não um usuário logado.
//
// O TEXTO NÃO MORA AQUI. Título e corpo vêm de `appointment_notice`, a mesma
// função que alimenta o sino do painel — senão as duas versões do mesmo aviso
// divergem com o tempo e ninguém percebe.
//
// A diferença entre as duas é um parâmetro: `p_health = false`. O push aparece
// na tela bloqueada, sem login, e `clients.alert_summary` diz coisas como
// "Gestante" ou "Tratamento oncológico" — dado sensível de saúde (LGPD art.
// 11) de alguém que não autorizou aquilo, visível pra quem passar perto do
// balcão. O push avisa que EXISTE algo a conferir; o que é, só dentro do app.
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`oauth_token_failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const secret = req.headers.get("x-push-secret");
  if (!secret || secret !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 401 });
  }

  const { event, appointment_id, salon_id, profile_id } = await req.json();
  if (!event || !appointment_id || !salon_id) {
    return new Response("bad_request", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // O mesmo texto do sino, sem a linha da ficha.
  const { data: notice } = await supabase.rpc("appointment_notice", {
    p_appointment: appointment_id,
    p_event: event,
    p_recipient: null,
    p_health: false,
  });

  const title = (notice as { title?: string } | null)?.title;
  const body = (notice as { body?: string } | null)?.body;
  // Agendamento apagado entre o trigger e aqui, ou evento que não sabemos
  // narrar: melhor não mandar nada do que mandar push vazio.
  if (!title || !body) {
    return new Response(JSON.stringify({ sent: 0, reason: "sem_texto" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Quem recebe. Lembrete de véspera e confirmação da cliente só interessam a
  // quem tem o horário; agendamento novo e cancelamento, ao salão inteiro.
  let alvo = (profile_id as string | null) ?? null;
  if (event === "confirmed" && !alvo) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("member_id")
      .eq("id", appointment_id)
      .maybeSingle();
    if (appt?.member_id) {
      const { data: membro } = await supabase
        .from("salon_members")
        .select("profile_id")
        .eq("id", appt.member_id)
        .maybeSingle();
      alvo = membro?.profile_id ?? null;
    }
  }

  let tokenQuery = supabase.from("push_subscriptions").select("id, token").eq("salon_id", salon_id);
  if ((event === "reminder" || event === "confirmed") && alvo) {
    tokenQuery = tokenQuery.eq("profile_id", alvo);
  }
  const { data: tokenRows } = await tokenQuery;

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!saJson) return new Response("missing_service_account", { status: 500 });
  const sa: ServiceAccount = JSON.parse(saJson);
  const accessToken = await getAccessToken(sa);

  let sent = 0;
  const staleIds: string[] = [];

  for (const row of tokenRows) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: { title, body },
            webpush: { fcm_options: { link: "/painel" } },
          },
        }),
      },
    );
    if (res.ok) {
      sent++;
    } else {
      const errText = await res.text();
      if (res.status === 404 || errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND")) {
        staleIds.push(row.id);
      }
    }
  }

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return new Response(JSON.stringify({ sent, cleaned: staleIds.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
