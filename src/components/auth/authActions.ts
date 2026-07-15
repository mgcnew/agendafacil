"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Login via Server Action (não client-side) para que o cookie de sessão
 * seja gravado via Set-Cookie do servidor, não via document.cookie no
 * navegador. No iOS/Safari (inclui o PWA instalado), cookies escritos por
 * JavaScript no cliente têm validade limitada a 7 dias pelo ITP, ignorando
 * o Max-Age configurado — por isso salões que não abrem o app por mais de
 * uma semana caíam e precisavam logar de novo.
 */
export async function signInAction(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: { code: error.code ?? null, message: error.message } };
  }
  return { error: null };
}
