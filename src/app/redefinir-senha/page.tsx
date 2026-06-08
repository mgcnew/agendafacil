"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Input, Label } from "@/components/ui";
import { Loader2, Check } from "lucide-react";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        "Não foi possível redefinir. O link pode ter expirado — peça um novo na tela de login.",
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/painel");
      router.refresh();
    }, 1300);
  }

  if (done) {
    return (
      <AuthShell title="Senha redefinida">
        <div className="text-center">
          <span className="grid place-items-center h-14 w-14 rounded-2xl bg-secondary text-primary mx-auto">
            <Check className="h-7 w-7" />
          </span>
          <p className="text-sm text-muted-foreground mt-5">
            Tudo certo! Já estamos te levando para o painel…
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar nova senha"
      subtitle="Defina uma nova senha para acessar o painel."
      footer={
        <>
          Lembrou a senha?{" "}
          <Link href="/entrar" className="text-primary font-medium">
            Voltar ao login
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <Input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="repita a senha"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar nova senha
        </Button>
      </form>
    </AuthShell>
  );
}
