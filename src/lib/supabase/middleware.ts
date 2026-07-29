import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getJwks } from "@/lib/supabase/jwks";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const path = request.nextUrl.pathname;

  // Painel da dona/equipe e onboarding exigem sessão
  const protectedPath =
    path.startsWith("/painel") || path.startsWith("/novo-salao");

  // getClaims em vez de getUser: `getUser()` vai à rede consultar o servidor de
  // auth em TODO request que casa com o matcher — inclusive páginas públicas.
  // `getClaims()` confere a assinatura do JWT localmente com a JWKS (o projeto
  // usa ES256), e continua renovando a sessão porque chama getSession() antes
  // de validar. A JWKS vem do cache de módulo; sem ela a biblioteca busca as
  // chaves pela rede a cada request e o ganho evapora.
  const jwks = await getJwks();
  const { data: claims } = await supabase.auth.getClaims(
    undefined,
    jwks ? { jwks } : undefined,
  );
  const user = claims?.claims?.sub ?? null;

  if (protectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
