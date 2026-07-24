import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getRP, setChallenge } from "@/lib/webauthn/server";

/**
 * Passo 1 do login por digital: gera o desafio.
 *
 * Se o cliente informa as credenciais deste aparelho (credentialIds), elas vão
 * em allowCredentials → o autenticador vai DIRETO pra biometria, sem a tela de
 * escolher/confirmar a conta. Sem elas, cai no fluxo de passkey descoberta
 * (allowCredentials vazio), que mostra o seletor de contas.
 */
export async function POST(request: Request) {
  const { rpID } = await getRP();

  const body = await request.json().catch(() => null);
  const rawIds = Array.isArray(body?.credentialIds) ? body.credentialIds : [];
  const credentialIds: string[] = rawIds.filter((x: unknown) => typeof x === "string");

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentialIds.map((id) => ({ id })),
  });

  await setChallenge(options.challenge);
  return NextResponse.json(options);
}
