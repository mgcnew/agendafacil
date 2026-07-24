"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém a sessão viva no celular sem depender só da renovação client-side
 * (que reescreve o cookie via document.cookie e recai no limite de 7 dias do
 * iOS/ITP). Ao voltar o foco/visibilidade — e periodicamente com o app aberto —
 * força um round-trip ao servidor (router.refresh), fazendo o proxy renovar a
 * sessão e re-emitir o cookie via Set-Cookie (que o iOS mantém pela janela
 * completa de 7 dias). Efeito prático: quem usa o app não cai mais.
 */
export function SessionKeepAlive() {
  const router = useRouter();
  const lastRun = useRef(0);

  useEffect(() => {
    // Evita rajadas: no máximo 1 refresh a cada 60s por foco/visibilidade.
    const MIN_INTERVAL = 60_000;
    // Renovação proativa com o app aberto, bem abaixo da validade do token (~1h).
    const KEEPALIVE_INTERVAL = 40 * 60_000;

    const refreshSession = () => {
      const now = Date.now();
      if (now - lastRun.current < MIN_INTERVAL) return;
      lastRun.current = now;
      router.refresh();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSession();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshSession);
    const timer = window.setInterval(refreshSession, KEEPALIVE_INTERVAL);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshSession);
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
