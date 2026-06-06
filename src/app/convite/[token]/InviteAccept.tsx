"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Input, Label, Textarea } from "@/components/ui";
import type { Enums } from "@/lib/database.types";
import { Loader2, Mail, AlertTriangle } from "lucide-react";

type Invite = {
  salon_name: string;
  salon_slug: string;
  email: string;
  role: Enums<"member_role">;
  display_name: string | null;
  status: string;
  expired: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietária",
  manager: "Gerente",
  professional: "Profissional",
  receptionist: "Recepção",
};

export function InviteAccept({
  token,
  invite,
}: {
  token: string;
  invite: Invite | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState(invite?.display_name ?? "");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  // ── Estados inválidos ────────────────────────────────────────
  if (!invite) {
    return (
      <InvalidState
        title="Convite não encontrado"
        message="Este link de convite é inválido. Peça um novo para o salão."
      />
    );
  }
  if (invite.status === "accepted") {
    return (
      <InvalidState
        title="Convite já utilizado"
        message="Este convite já foi aceito. Faça login para acessar o painel."
        action={{ href: "/entrar", label: "Ir para o login" }}
      />
    );
  }
  if (invite.status === "revoked") {
    return (
      <InvalidState
        title="Convite cancelado"
        message="Este convite foi cancelado pelo salão. Peça um novo, se necessário."
      />
    );
  }
  if (invite.expired) {
    return (
      <InvalidState
        title="Convite expirado"
        message="Este convite expirou. Peça para o salão gerar um novo link."
      />
    );
  }

  async function acceptWithSession() {
    const supabase = createClient();
    const { data: slug, error } = await supabase.rpc("accept_invite", {
      p_token: token,
      p_full_name: fullName,
      p_phone: phone,
      p_display_name: displayName,
      p_bio: bio,
    });
    if (error) {
      setError(
        error.message.includes("email_mismatch")
          ? "O e-mail da conta não corresponde ao convite."
          : "Não foi possível concluir. Tente novamente.",
      );
      setLoading(false);
      return;
    }
    router.push(`/painel/${slug as string}`);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // 1) tenta criar a conta com o e-mail do convite
    const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpErr && !signUpErr.message.toLowerCase().includes("already")) {
      setError("Não foi possível criar a conta. Verifique a senha (mín. 6 caracteres).");
      setLoading(false);
      return;
    }

    // 2) garante sessão (conta nova sem confirmação, ou conta já existente)
    if (!signUp?.session) {
      const { data: signIn } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });
      if (!signIn.session) {
        if (signUpErr) {
          // já existia conta e a senha não bateu
          setError("Já existe uma conta com este e-mail. Informe a senha correta.");
          setLoading(false);
          return;
        }
        // conta criada mas exige confirmação de e-mail
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }
    }

    await acceptWithSession();
  }

  if (needsConfirm) {
    return (
      <InvalidState
        title="Confirme seu e-mail"
        message={`Enviamos um link de confirmação para ${invite.email}. Após confirmar, abra novamente este convite para concluir.`}
      />
    );
  }

  // ── Formulário ───────────────────────────────────────────────
  return (
    <AuthShell
      title="Complete seu cadastro"
      subtitle={`Você foi convidada para ${invite.salon_name} como ${ROLE_LABEL[invite.role] ?? invite.role}.`}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>E-mail do convite</Label>
          <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-muted px-3.5 h-11 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{invite.email}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Seu nome completo</Label>
          <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Maria Silva" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Nome de exibição</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Como aparece p/ clientes" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">Mini-bio (opcional)</Label>
          <Textarea id="bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Especialidades, experiência…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Crie uma senha</Label>
          <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar na equipe
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Comissões e horários são definidos pelo salão.
        </p>
      </form>
    </AuthShell>
  );
}

function InvalidState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <AuthShell title={title}>
      <div className="text-center">
        <span className="grid place-items-center h-14 w-14 rounded-2xl bg-secondary text-primary mx-auto">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <p className="text-sm text-muted-foreground mt-5">{message}</p>
        {action && (
          <Link href={action.href} className="inline-block mt-6">
            <Button size="lg">{action.label}</Button>
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
