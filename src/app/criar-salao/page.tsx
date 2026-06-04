"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { Scissors, Loader2, MailCheck } from "lucide-react";

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

    // Se a sessão já veio (confirmação de e-mail desativada), segue para o onboarding.
    if (data.session) {
      router.push("/novo-salao");
      router.refresh();
      return;
    }

    // Tenta logar direto (caso confirmação esteja desativada mas sem auto-sessão).
    const { data: signIn } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
      <div className="min-h-full grid place-items-center px-5 py-12">
        <Card className="w-full max-w-md p-8 text-center">
          <MailCheck className="h-10 w-10 mx-auto text-primary" />
          <h1 className="font-display text-xl font-bold mt-4">Confirme seu e-mail</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enviamos um link de confirmação para <b>{email}</b>. Após confirmar,
            faça login para criar o seu salão.
          </p>
          <Link href="/entrar" className="inline-block mt-6">
            <Button>Ir para o login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full grid place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 font-display font-bold text-xl mb-6">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <Scissors className="h-5 w-5" />
          </span>
          AgendeFácil
        </Link>
        <h1 className="font-display text-2xl font-bold text-center mb-1">
          Criar sua conta
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Em seguida você configura o seu salão.
        </p>
        <Card className="p-8">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </form>
        </Card>
        <p className="text-sm text-muted-foreground text-center mt-6">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-primary font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
