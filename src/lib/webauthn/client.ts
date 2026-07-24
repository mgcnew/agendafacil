"use client";

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

// IDs das credenciais cadastradas NESTE aparelho. Guardar isso permite passar
// allowCredentials no login → o autenticador vai direto pra biometria, sem a
// tela de "escolher/confirmar a conta" (que aparece com passkey descoberta).
const CRED_IDS_KEY = "af:bio-cred-ids";

function readCredIds(): string[] {
  try {
    const raw = localStorage.getItem(CRED_IDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function rememberCredId(id: string) {
  try {
    const ids = new Set(readCredIds());
    ids.add(id);
    localStorage.setItem(CRED_IDS_KEY, JSON.stringify([...ids]));
  } catch {}
}

/** Há autenticador de plataforma (Touch ID / Face ID / digital) disponível? */
export async function biometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !browserSupportsWebAuthn()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Cadastra a digital deste aparelho (usuário já logado). */
export async function enrollBiometric(deviceName?: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const optRes = await fetch("/api/webauthn/register/options", { method: "POST" });
    if (!optRes.ok) return { ok: false, error: "options_failed" };
    const optionsJSON = await optRes.json();

    const credential = await startRegistration({ optionsJSON });

    const verifyRes = await fetch("/api/webauthn/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, deviceName: deviceName ?? null }),
    });
    if (!verifyRes.ok) {
      const j = await verifyRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "verify_failed" };
    }
    // Lembra a credencial deste aparelho → login vai direto pra digital.
    rememberCredId(credential.id);
    return { ok: true };
  } catch (e) {
    // Usuário cancelou o gesto ou o navegador não suporta.
    const name = (e as { name?: string })?.name;
    return { ok: false, error: name === "NotAllowedError" ? "cancelled" : "unexpected" };
  }
}

/**
 * Login por digital. Em sucesso, faz navegação de página real para /auth/enter,
 * que reemite o cookie de sessão via Set-Cookie (persistência no iOS).
 */
export async function loginWithBiometric(
  next = "/painel",
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Passa as credenciais deste aparelho → sem seletor de conta, vai direto
    // pra digital. Sem nenhuma lembrada, cai no fluxo descoberto (com seletor).
    const credentialIds = readCredIds();
    const optRes = await fetch("/api/webauthn/auth/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentialIds }),
    });
    if (!optRes.ok) return { ok: false, error: "options_failed" };
    const optionsJSON = await optRes.json();

    const credential = await startAuthentication({ optionsJSON });

    const verifyRes = await fetch("/api/webauthn/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!verifyRes.ok) {
      const j = await verifyRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "verify_failed" };
    }

    // Reforça a lembrança da credencial usada neste aparelho.
    rememberCredId(credential.id);
    window.location.assign(`/auth/enter?next=${encodeURIComponent(next)}`);
    return { ok: true };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return { ok: false, error: name === "NotAllowedError" ? "cancelled" : "unexpected" };
  }
}
