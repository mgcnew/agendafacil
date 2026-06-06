"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Input, Label } from "@/components/ui";
import {
  Loader2,
  MailCheck,
  Check,
  CalendarCheck,
  Percent,
  Boxes,
} from "lucide-react";

const MOBILE_BENEFITS = [
  { icon: CalendarCheck, text: "A cliente agenda sozinha pelo seu link" },
  { icon: Percent, text: "Comissões e caixa no automático" },
  { icon: Boxes, text: "Estoque com baixa por serviço" },
];

const TRUST_BADGES = [
  "Sem cartão de crédito",
  "Configurado em 2 minutos",
  "Cancele quando quiser",
];

export default function CriarSalaoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/novo-salao");
      router.refresh();
      return;
    }

    const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.session) {
      router.push("/novo-salao");
      router.refresh();
      return;
    }

    setNeedsConfirm(true);
    setLoading(false);
  }

  if (needsConfirm) {
    return (
      <AuthShell title="Confirme seu e-mail">
        <div className="text-center">
          <span className="grid place-items-center h-14 w-14 rounded-2xl bg-secondary text-primary mx-auto">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="text-sm text-muted-foreground mt-5">
            Enviamos um link de confirmação para <b className="text-foreground">{email}</b>.
            Após confirmar, faça login para criar o seu salão.
          </p>
          <Link href="/entrar" className="inline-block mt-6">
            <Button size="lg">Ir para o login</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Em seguida você configura o seu salão — leva 2 minutos."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/entrar" className="text-primary font-medium">
            Entrar
          </Link>
        </>
      }
    >
      {/* Benefícios — visíveis no mobile (no desktop ficam no painel lateral) */}
      <div className="lg:hidden mb-6 rounded-[var(--radius)] border border-border bg-card p-4">
        <ul className="space-y-2.5">
          {MOBILE_BENEFITS.map((b) => (
            <li key={b.text} className="flex items-center gap-2.5 text-sm">
              <span className="grid place-items-center h-7 w-7 rounded-lg bg-secondary text-primary shrink-0">
                <b.icon className="h-4 w-4" />
              </span>
              {b.text}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@salao.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar conta
        </Button>

        {/* Selos de confiança — quebra de objeção */}
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-1">
          {TRUST_BADGES.map((t) => (
            <li
              key={t}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Check className="h-3 w-3 text-primary shrink-0" /> {t}
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground text-center">
          Ao criar a conta você concorda com os termos de uso.
        </p>
      </form>
    </AuthShell>
  );
}
