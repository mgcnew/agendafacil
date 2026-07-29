import type { JWK } from "@supabase/supabase-js";

/**
 * Chaves públicas do Supabase Auth, guardadas no escopo do módulo.
 *
 * Por que existe: `getClaims()` valida a assinatura do JWT localmente, sem ir
 * ao servidor de auth — mas só quando já tem a JWKS em mãos. O cache dela vive
 * DENTRO do cliente (`this.jwks`, GoTrueClient), e no servidor a gente cria um
 * cliente novo a cada request. Ou seja: o cache nascia vazio toda vez e a
 * biblioteca buscava /.well-known/jwks.json pela rede em toda navegação. A
 * "verificação local" trocava uma ida de rede (/auth/v1/user) por outra.
 *
 * No escopo do módulo o valor sobrevive entre requests da mesma instância da
 * função na Vercel, que é o que faz a verificação ser de fato local.
 *
 * TTL de 10 minutos, igual ao da biblioteca: chave rotacionada entra sozinha.
 */
const TTL_MS = 10 * 60 * 1000;

let cache: { keys: JWK[] } | null = null;
let buscadoEm = 0;
let emVoo: Promise<{ keys: JWK[] } | null> | null = null;

async function buscar(): Promise<{ keys: JWK[] } | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
      // O cache do Next não deve entrar aqui: quem controla a validade é o TTL
      // acima, e uma resposta velha travada em disco seria pior.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { keys?: JWK[] };
    if (!data.keys?.length) return null;
    cache = { keys: data.keys };
    buscadoEm = Date.now();
    return cache;
  } catch {
    // Falhar aqui não pode derrubar a autenticação: sem JWKS, getClaims cai
    // sozinho no caminho antigo (uma ida de rede a mais, e só).
    return null;
  }
}

export async function getJwks(): Promise<{ keys: JWK[] } | null> {
  if (cache && Date.now() - buscadoEm < TTL_MS) return cache;
  // Requests concorrentes no mesmo processo esperam a mesma busca em vez de
  // dispararem uma cada.
  emVoo ??= buscar().finally(() => { emVoo = null; });
  return emVoo;
}
