import "server-only";
import { cookies, headers } from "next/headers";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

/**
 * Configuração do Relying Party (RP) derivada do host da requisição, então
 * funciona igual em localhost, preview da Vercel e produção — sem hardcode.
 * - rpID: o domínio (sem porta). É a âncora da passkey; precisa bater com o host.
 * - origin: usado na verificação da assertion (protocolo + host).
 */
export async function getRP() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rpID = host.split(":")[0];
  const origin = `${proto}://${host}`;
  return { rpID, origin, rpName: "Zulan" };
}

const CHALLENGE_COOKIE = "webauthn_chal";

/** Guarda o desafio entre /options e /verify (cookie httpOnly de vida curta). */
export async function setChallenge(challenge: string) {
  const c = await cookies();
  c.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300, // 5 min para concluir o gesto biométrico
  });
}

export async function takeChallenge(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(CHALLENGE_COOKIE)?.value ?? null;
  if (value) c.delete(CHALLENGE_COOKIE);
  return value;
}

/** Copia para um Uint8Array com ArrayBuffer "puro" (TS 5.7+ é estrito quanto
 *  a ArrayBufferLike vs ArrayBuffer nas libs de WebAuthn). */
function toPlainBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}

/** uuid (string) → Uint8Array para o userID do WebAuthn (e volta no login). */
export function userIdToBytes(uuid: string): Uint8Array<ArrayBuffer> {
  return toPlainBytes(new TextEncoder().encode(uuid));
}
export function bytesToUserId(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Helpers base64url para persistir a chave pública (bytes) na tabela. */
export const b64 = {
  fromBytes: (bytes: Uint8Array) => isoBase64URL.fromBuffer(toPlainBytes(bytes)),
  toBytes: (value: string) => isoBase64URL.toBuffer(value),
};
