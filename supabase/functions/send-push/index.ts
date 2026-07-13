// Recebe o evento do trigger `notify_appointment_event` (appointments) e
// dispara push via FCM HTTP v1 pra todo mundo inscrito naquele salão.
// Autenticação: header `x-push-secret` (compartilhado com o trigger via
// Supabase Vault) — a função roda com --no-verify-jwt porque quem chama é o
// Postgres, não um usuário logado.
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
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

  // Lembrete de véspera é só pra profissional do horário; created/cancelled
  // avisa o salão inteiro.
  let tokenQuery = supabase.from("push_subscriptions").select("id, token").eq("salon_id", salon_id);
  if (event === "reminder" && profile_id) {
    tokenQuery = tokenQuery.eq("profile_id", profile_id);
  }
  const { data: tokenRows } = await tokenQuery;

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("starts_at, member_id, clients(full_name), appointment_services(name)")
    .eq("id", appointment_id)
    .maybeSingle();

  const clientName = (appt?.clients as { full_name?: string } | null)?.full_name ?? "Cliente";
  const services = ((appt?.appointment_services as { name: string }[] | null) ?? []).map((s) => s.name).join(", ");
  const time = appt ? formatTime(appt.starts_at) : "";

  let waitingSuffix = "";
  if (event === "cancelled" && appt) {
    const preferredDate = appt.starts_at.slice(0, 10); // preferred_date é date, comparável ao prefixo YYYY-MM-DD do timestamptz em America/Sao_Paulo
    const { count } = await supabase
      .from("appointment_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon_id)
      .eq("status", "waiting")
      .eq("preferred_date", preferredDate)
      .or(`member_id.is.null,member_id.eq.${appt.member_id}`);
    if (count && count > 0) waitingSuffix = ` · ${count} na lista de espera`;
  }

  const title = event === "cancelled"
    ? "Agendamento cancelado"
    : event === "reminder"
    ? "Amanhã você tem horário"
    : "Novo agendamento";
  const body = (services
    ? `${clientName} · ${services}${time ? ` às ${time}` : ""}`
    : `${clientName}${time ? ` às ${time}` : ""}`) + waitingSuffix;

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
