"use client";

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

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
    const optRes = await fetch("/api/webauthn/auth/options", { method: "POST" });
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

    window.location.assign(`/auth/enter?next=${encodeURIComponent(next)}`);
    return { ok: true };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return { ok: false, error: name === "NotAllowedError" ? "cancelled" : "unexpected" };
  }
}
