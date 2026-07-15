"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { acceptInviteAction } from "@/components/auth/authActions";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Input, Label, Textarea } from "@/components/ui";
import type { Enums } from "@/lib/database.types";
import {
  CircleNotch,
  Envelope,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

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
  // Se a pessoa já está logada (ex.: acabou de confirmar o e-mail e voltou
  // para cá pelo callback), pulamos a senha e só finalizamos o cadastro.
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!invite) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email?.toLowerCase() === invite.email.toLowerCase()) {
        setAuthed(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setLoading(true);
    setError(null);

    // Quando já logada (voltou da confirmação de e-mail) o password vai null e
    // a action só finaliza o convite; senão ela cria/loga a conta antes.
    const res = await acceptInviteAction({
      token,
      email: invite.email,
      password: authed ? null : password,
      fullName,
      phone,
      displayName,
      bio,
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/convite/${token}`,
      )}`,
    });

    if (res.status === "needs_confirm") {
      setNeedsConfirm(true);
      setLoading(false);
      return;
    }
    if (res.status === "error") {
      setError(res.message);
      setLoading(false);
      return;
    }

    router.push(`/painel/${res.slug}`);
    router.refresh();
  }

  if (needsConfirm) {
    return (
      <InvalidState
        title="Confirme seu e-mail"
        message={`Enviamos um link de confirmação para ${invite.email}. Abra o e-mail e clique no link — você volta para cá já autenticada para concluir o cadastro.`}
      />
    );
  }

  // ── Formulário ───────────────────────────────────────────────
  return (
    <AuthShell
      title="Complete seu cadastro"
      subtitle={
        authed
          ? `E-mail confirmado! Finalize seu cadastro em ${invite.salon_name}.`
          : `Você foi convidada para ${invite.salon_name} como ${ROLE_LABEL[invite.role] ?? invite.role}.`
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>E-mail do convite</Label>
          <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-muted px-3.5 h-11 text-sm text-muted-foreground">
            <Envelope className="h-4 w-4 shrink-0" />
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

        {!authed && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Crie uma senha</Label>
            <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <CircleNotch className="h-4 w-4 animate-spin" />}
          {authed ? "Concluir cadastro" : "Entrar na equipe"}
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
          <Warning className="h-7 w-7" />
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
