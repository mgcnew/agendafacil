import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Demo em 1 clique. Cria uma sessão da conta demo do nicho SEM senha —
 * usa a service key (server-only) pra gerar um token de acesso e estabelece
 * a sessão (cookies), jogando direto no painel. A pessoa vê o produto como
 * um assinante veria, sem digitar nada e sem configuração de ambiente.
 *
 * Seguro: o salão demo é sandbox (isento, fora das métricas, sem efeito
 * externo, resetado toda madrugada). Falha no login → cai na página pública.
 */
const DEMOS: Record<string, { email: string; slug: string }> = {
  salao: { email: "demo.salao@teste.com", slug: "demo-salao" },
  barbearia: { email: "demo.barbearia@teste.com", slug: "demo-barbearia" },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vertical: string }> },
) {
  const { origin } = new URL(request.url);
  const { vertical } = await params;
  const demo = DEMOS[vertical];
  if (!demo) return NextResponse.redirect(`${origin}/`);

  try {
    // 1) Gera um token de magic link pra conta demo (não envia e-mail).
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: demo.email,
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw error ?? new Error("sem token");

    // 2) Consome o token no client de servidor → grava a sessão em cookies.
    const supabase = await createClient();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (verifyErr) throw verifyErr;

    return NextResponse.redirect(`${origin}/painel/${demo.slug}`);
  } catch {
    // Sem conseguir logar → mostra ao menos a página pública (visão da cliente).
    return NextResponse.redirect(`${origin}/${demo.slug}`);
  }
}
