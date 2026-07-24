import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ponte de entrada pós-login.
 *
 * Depois do login (Server Action), o cliente NAVEGA (top-level) para cá em vez
 * de fazer navegação SPA. Aqui forçamos a rotação da sessão, o que re-emite o
 * cookie de auth via `Set-Cookie` numa resposta de NAVEGAÇÃO — e o iOS/PWA
 * persiste esses cookies em disco de forma confiável, ao contrário dos cookies
 * vindos de fetch/XHR (a resposta do Server Action), que ele costuma tratar como
 * "de sessão" e descartar ao fechar o app (causa do logout a cada reabertura).
 *
 * Como é uma navegação de página real, o painel também carrega por completo — o
 * script inline de tema roda e o modo noturno aplica de primeira (sem flash claro).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Evita open-redirect: só caminhos internos ("/algo", nunca "//externo").
  const nextParam = searchParams.get("next") || "/painel";
  const dest =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/painel";

  const supabase = await createClient();
  // Rotaciona a sessão → grava o cookie novo via Set-Cookie NESTA navegação.
  const { data, error } = await supabase.auth.refreshSession();

  // Se não deu para renovar e não há usuário, manda pro login.
  if (error && !data?.user) {
    return NextResponse.redirect(`${origin}/entrar`);
  }

  return NextResponse.redirect(`${origin}${dest}`);
}
