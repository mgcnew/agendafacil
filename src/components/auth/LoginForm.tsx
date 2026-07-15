"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signInAction } from "./authActions";
import { Button, Input, Label } from "@/components/ui";
import {
  Check,
  CircleNotch,
  EnvelopeSimpleOpen,
} from "@phosphor-icons/react/dist/ssr";

const REMEMBER_KEY = "agendefacil:lastEmail";

/**
 * Formulário de login compartilhado entre a página /entrar (fallback de
 * deep-link/redirect) e o modal de login da landing page.
 * Inclui "lembrar e-mail" e "esqueci a senha".
 */
export function LoginForm({
  next = "/painel",
  onSuccess,
}: {
  next?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  // pré-preenche o e-mail lembrado
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) : null;
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signInAction(email, password);
    if (error) {
      const notConfirmed =
        error.code === "email_not_confirmed" ||
        error.message.toLowerCase().includes("not confirmed");
      setError(
        notConfirmed
          ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
          : "E-mail ou senha incorretos.",
      );
      setLoading(false);
      return;
    }
    // lembrar e-mail
    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);

    onSuccess?.();
    router.push(next);
    router.refresh();
  }

  async function forgotPassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) {
      setError("Informe o e-mail para recuperar a senha.");
      return;
    }
    setResetting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setResetting(false);
    if (error) {
      setError("Não foi possível enviar o e-mail de recuperação.");
      return;
    }
    setResetSent(true);
  }

  if (resetSent) {
    return (
      <div className="text-center py-2">
        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-secondary text-primary mx-auto">
          <EnvelopeSimpleOpen className="h-6 w-6" />
        </span>
        <p className="text-sm text-muted-foreground mt-4">
          Enviamos um link de redefinição para{" "}
          <b className="text-foreground">{email}</b>. Abra o e-mail para criar uma nova senha.
        </p>
        <button
          type="button"
          onClick={() => { setResetSent(false); setMode("login"); }}
          className="text-sm text-primary font-medium mt-4"
        >
          Voltar ao login
        </button>
      </div>
    );
  }

  // ── Modo "Esqueci a senha": pede apenas o e-mail ──────────────
  if (mode === "forgot") {
    return (
      <form onSubmit={forgotPassword} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos um link para você criar uma nova senha.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">E-mail</Label>
          <Input
            id="reset-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@salao.com"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={resetting}>
          {resetting && <CircleNotch className="h-4 w-4 animate-spin" />}
          Enviar link de recuperação
        </Button>
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); }}
          className="w-full text-sm text-primary font-medium"
        >
          Voltar ao login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@salao.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {/* Lembrar e-mail + esqueci a senha */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRemember((v) => !v)}
          className="flex items-center gap-2 text-sm text-foreground/80"
        >
          <span
            className={`grid place-items-center h-4 w-4 rounded border transition ${
              remember ? "bg-primary border-primary text-primary-foreground" : "border-border"
            }`}
          >
            {remember && <Check className="h-3 w-3" />}
          </span>
          Lembrar e-mail
        </button>
        <button
          type="button"
          onClick={() => { setMode("forgot"); setError(null); }}
          className="text-sm text-primary font-medium hover:underline"
        >
          Esqueci a senha
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <CircleNotch className="h-4 w-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
