import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de autenticação (PKCE).
 *
 * Todos os links de e-mail do Supabase (confirmação de cadastro, recuperação
 * de senha, magic link) voltam para cá com `?code=...`. Aqui trocamos o código
 * por uma sessão (cookies) e seguimos para o destino certo.
 *
 * Sem esta rota o link caía em "/" com `?code` sem efeito — era a causa do
 * "senha incorreta" pós-confirmação e do reset de senha que não funcionava.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/painel";
  const type = searchParams.get("type"); // "recovery" em redefinição de senha

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=expirado`);
  }

  // Recuperação de senha sempre vai para a tela de nova senha.
  const dest = type === "recovery" ? "/redefinir-senha" : next;
  return NextResponse.redirect(`${origin}${dest}`);
}
