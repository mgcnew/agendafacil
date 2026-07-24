import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Restaura a sessão a partir de um refresh token (guardado no localStorage do
 * aparelho). Usado quando o iOS descartou o cookie de sessão: em vez de pedir
 * login, reconstruímos a sessão no servidor e gravamos os cookies de novo.
 *
 * O refresh token é de uso único (rotaciona), então a resposta já traz um par
 * novo nos cookies; o cliente logo navega para /auth/enter para reemitir via
 * Set-Cookie de navegação (persistência no iOS).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refreshToken = body?.refresh_token;
  if (!refreshToken || typeof refreshToken !== "string") {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return NextResponse.json({ error: "restore_failed" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
