"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { getStoredRefreshToken, clearStoredRefreshToken } from "@/lib/auth/persistentSession";

/**
 * Na tela de login, tenta reentrar sozinho: se o cookie de sessão foi descartado
 * pelo iOS mas ainda há um refresh token no localStorage, restaura a sessão no
 * servidor e segue pro destino — sem mostrar o formulário. Só cai no login se
 * não houver token (logout ou storage limpo) ou se a restauração falhar.
 */
export function SilentRestore({ next, children }: { next: string; children: ReactNode }) {
  // Começa "checando" (mesma marcação em SSR e no 1º render → sem hydration
  // mismatch); o efeito decide na hora se restaura ou mostra o login.
  const [state, setState] = useState<"checking" | "restoring" | "idle">("checking");

  useEffect(() => {
    const rt = getStoredRefreshToken();
    if (!rt) {
      setState("idle");
      return;
    }
    setState("restoring");
    (async () => {
      try {
        // Se a rede travar, não deixa o usuário preso no "Entrando…".
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch("/auth/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: rt }),
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          // Navegação real → reemite o cookie de forma durável (iOS) e segue.
          window.location.assign(`/auth/enter?next=${encodeURIComponent(next)}`);
          return;
        }
        // Token inválido/expirado: limpa e mostra o login normal.
        clearStoredRefreshToken();
        setState("idle");
      } catch {
        setState("idle");
      }
    })();
  }, [next]);

  if (state === "idle") return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
      <CircleNotch className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm">Entrando…</p>
    </div>
  );
}
