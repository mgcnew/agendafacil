import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getRP, setChallenge } from "@/lib/webauthn/server";

/**
 * Passo 1 do login por digital: gera o desafio. Usa passkey descoberta
 * (allowCredentials vazio), então o aparelho oferece as contas que tem — sem
 * precisar digitar e-mail.
 */
export async function POST() {
  const { rpID } = await getRP();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: [],
  });

  await setChallenge(options.challenge);
  return NextResponse.json(options);
}
