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

/**
 * Cadastro da dona do salão via Server Action — mesmo motivo do login: o
 * cookie de sessão precisa nascer via Set-Cookie do servidor para não cair
 * no limite de 7 dias do ITP no iOS/PWA. Espelha a lógica antiga do cliente
 * (tenta signUp; se a conta já vier com sessão navega, senão tenta login;
 * senão pede confirmação de e-mail).
 */
export async function signUpOwnerAction(
  name: string,
  email: string,
  password: string,
): Promise<
  | { status: "session" }
  | { status: "needs_confirm" }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) return { status: "error", message: error.message };
  if (data.session) return { status: "session" };

  const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.session) return { status: "session" };

  return { status: "needs_confirm" };
}

/**
 * Aceite de convite de equipe via Server Action. Faz o cadastro/login (quando
 * `password` vem preenchido) e, na sequência, roda a RPC `accept_invite` já
 * autenticada dentro do mesmo request — garantindo que o cookie de sessão
 * seja gravado pelo servidor (Set-Cookie), não pelo navegador. Quando a
 * usuária já está logada (voltou da confirmação de e-mail), `password` é null
 * e a action só finaliza o convite.
 */
export async function acceptInviteAction(params: {
  token: string;
  email: string;
  password: string | null;
  fullName: string;
  phone: string;
  displayName: string;
  bio: string;
  emailRedirectTo: string;
}): Promise<
  | { status: "done"; slug: string }
  | { status: "needs_confirm" }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();

  if (params.password !== null) {
    const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { full_name: params.fullName },
        emailRedirectTo: params.emailRedirectTo,
      },
    });

    if (signUpErr && !signUpErr.message.toLowerCase().includes("already")) {
      const msg = signUpErr.message.toLowerCase();
      const code = signUpErr.code ?? "";
      let friendly = "Não foi possível criar a conta. Tente novamente.";
      if (code === "email_provider_disabled" || msg.includes("signups are disabled")) {
        friendly = "Cadastros por e-mail estão desativados no momento. Avise o administrador do salão.";
      } else if (msg.includes("password") || msg.includes("weak") || msg.includes("6")) {
        friendly = "Senha inválida. Use no mínimo 6 caracteres.";
      } else if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
        friendly = "Muitas tentativas em sequência. Aguarde alguns minutos e tente de novo.";
      }
      return { status: "error", message: friendly };
    }

    if (!signUp?.session) {
      const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });
      if (!signIn.session) {
        const notConfirmed =
          signInErr?.code === "email_not_confirmed" ||
          signInErr?.message.toLowerCase().includes("not confirmed");
        if (notConfirmed || !signUpErr) {
          return { status: "needs_confirm" };
        }
        return {
          status: "error",
          message:
            "Já existe uma conta com este e-mail. Use 'Esqueci a senha' no login para redefinir.",
        };
      }
    }
  }

  // Sessão garantida (usuária já logada ou recém-autenticada): finaliza o convite.
  const { data: slug, error } = await supabase.rpc("accept_invite", {
    p_token: params.token,
    p_full_name: params.fullName,
    p_phone: params.phone,
    p_display_name: params.displayName,
    p_bio: params.bio,
  });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("email_mismatch")
        ? "O e-mail da conta não corresponde ao convite."
        : "Não foi possível concluir. Tente novamente.",
    };
  }
  return { status: "done", slug: slug as string };
}
