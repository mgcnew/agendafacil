import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getRP, setChallenge, userIdToBytes } from "@/lib/webauthn/server";

/**
 * Passo 1 do cadastro da digital (precisa estar logado): gera as opções de
 * registro (desafio) para o aparelho criar a passkey via biometria.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { rpID, rpName } = await getRP();

  // Não recadastra credenciais que este usuário já tem neste RP.
  const { data: existing } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userIdToBytes(user.id),
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "Conta Zulan",
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: "required", // passkey descoberta → login sem digitar e-mail
      userVerification: "required", // exige biometria/PIN
    },
  });

  await setChallenge(options.challenge);
  return NextResponse.json(options);
}

// Tipo do simplewebauthn (evita import quebrando build se a subpath mudar).
type AuthenticatorTransportFuture =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";
