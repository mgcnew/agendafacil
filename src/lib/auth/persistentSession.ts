"use client";

/**
 * Guarda o refresh token no localStorage — que, no iOS/PWA, sobrevive ao fechar
 * o app melhor que o cookie de sessão (que o ITP descarta). Serve de "backup":
 * se o cookie some, restauramos a sessão a partir daqui, sem pedir login.
 *
 * Observação de segurança: o cookie de sessão do Supabase já é legível por
 * script (httpOnly:false), então guardar o refresh token aqui não amplia de
 * forma relevante a superfície de XSS que já existe.
 */
const RT_KEY = "af:rt";

export function storeRefreshToken(rt: string | null | undefined) {
  try {
    if (rt) localStorage.setItem(RT_KEY, rt);
  } catch {}
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

export function clearStoredRefreshToken() {
  try {
    localStorage.removeItem(RT_KEY);
  } catch {}
}
