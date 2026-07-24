"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { storeRefreshToken, clearStoredRefreshToken } from "@/lib/auth/persistentSession";

/**
 * Mantém o refresh token espelhado no localStorage enquanto o usuário está
 * logado. Captura no carregamento, a cada rotação de token e ao mandar o app
 * pro segundo plano (pega o mais fresco antes de fechar). Assim, se o iOS
 * apagar o cookie, o SilentRestore consegue reentrar sozinho.
 */
export function SessionPersistence() {
  useEffect(() => {
    const supabase = createClient();

    const capture = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.refresh_token) storeRefreshToken(data.session.refresh_token);
    };

    capture();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearStoredRefreshToken();
        return;
      }
      if (session?.refresh_token) storeRefreshToken(session.refresh_token);
    });

    const onHidden = () => {
      if (document.visibilityState === "hidden") capture();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  return null;
}
