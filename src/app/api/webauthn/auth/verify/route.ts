import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRP, takeChallenge, b64 } from "@/lib/webauthn/server";

/**
 * Passo 2 do login por digital: verifica a assertion e, se válida, CRIA a sessão
 * Supabase para o dono da credencial (sem senha) via generateLink + verifyOtp.
 *
 * A leitura/atualização da credencial usa service_role (ignora RLS) porque o
 * usuário ainda não está autenticado neste ponto.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const assertion = body?.credential;
  if (!assertion?.id) {
    return NextResponse.json({ error: "missing_credential" }, { status: 400 });
  }

  const expectedChallenge = await takeChallenge();
  if (!expectedChallenge) {
    return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Localiza a credencial apresentada (independe de RLS: service_role).
  const { data: cred } = await admin
    .from("webauthn_credentials")
    .select("id, user_id, public_key, counter, transports")
    .eq("credential_id", assertion.id)
    .maybeSingle();
  if (!cred) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 401 });
  }

  const { rpID, origin } = await getRP();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: assertion.id,
        publicKey: b64.toBytes(cred.public_key),
        counter: Number(cred.counter),
        transports: (cred.transports ?? undefined) as
          | ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[]
          | undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "not_verified" }, { status: 401 });
  }

  // Atualiza o contador (proteção anti-clonagem) e marca uso.
  await admin
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  // Descobre o e-mail do dono para emitir a sessão.
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(cred.user_id);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  // Emite um token de magic link (sem enviar e-mail) e o troca por sessão,
  // gravando os cookies de sessão nesta resposta.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    return NextResponse.json({ error: "session_mint_failed" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (otpErr) {
    return NextResponse.json({ error: "session_mint_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
