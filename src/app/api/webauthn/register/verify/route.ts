import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getRP, takeChallenge, b64 } from "@/lib/webauthn/server";

/**
 * Passo 2 do cadastro da digital: verifica a resposta do aparelho e salva a
 * credencial (chave pública) ligada ao usuário. Roda autenticado — o insert
 * respeita a RLS (auth.uid() = user_id).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const attResp = body?.credential;
  const deviceName: string | null = body?.deviceName ?? null;
  if (!attResp) {
    return NextResponse.json({ error: "missing_credential" }, { status: 400 });
  }

  const expectedChallenge = await takeChallenge();
  if (!expectedChallenge) {
    return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
  }

  const { rpID, origin } = await getRP();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attResp,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "not_verified" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  const { error } = await supabase.from("webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: b64.fromBytes(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? null,
    device_name: deviceName,
  });
  if (error) {
    // 23505 = unique_violation (credencial já cadastrada neste aparelho)
    const already = error.code === "23505";
    return NextResponse.json(
      { error: already ? "already_registered" : "save_failed" },
      { status: already ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
