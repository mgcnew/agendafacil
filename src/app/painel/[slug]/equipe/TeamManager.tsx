"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { uploadMemberPhoto, removeMemberPhoto } from "./actions";
import { generateCommissionReceiptPdf } from "./commissionReceipt";
import type { SalonInfo } from "../financeiro/receipt";
import { formatBRL, currentMonthBR, monthRangeBR, cn } from "@/lib/utils";
import type { Tables, Enums } from "@/lib/database.types";
import {
  Armchair,
  Briefcase,
  Camera,
  Check,
  CircleNotch,
  Crown,
  DownloadSimple,
  Envelope,
  FileText,
  LinkSimple,
  MapPin,
  PencilSimple,
  Scissors,
  ShareNetwork,
  ShieldCheck,
  Trash,
  User,
  UserPlus,
  Wallet,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";

type Role = Enums<"member_role">;
type Member = Tables<"salon_members"> & {
  profiles: { full_name: string | null; email: string | null } | null;
};
type Invite = Tables<"salon_invites">;
type Permission = Tables<"permissions">;
type RoleDefault = Tables<"role_permissions">;
type Svc = { id: string; name: string; commission_percent: number | null };

const ROLE_LABEL: Record<Role, string> = {
  owner: "Proprietária",
  manager: "Gerente",
  professional: "Profissional",
  receptionist: "Recepção",
};
const ROLE_OPTIONS: Role[] = ["manager", "professional", "receptionist"];

/** Paleta de cores para o avatar (quando não há foto). */
const AVATAR_COLORS = [
  "#8e3b5e", "#db2777", "#7c3aed", "#2563eb",
  "#0891b2", "#047857", "#b5832a", "#dc2626",
];

export function TeamManager({
  salonId,
  myRole,
  members: initialMembers,
  permissions,
  roleDefaults,
  invites: initialInvites,
  services,
  serviceCounts,
  canSeeFinance,
  salon,
}: {
  salonId: string;
  myRole: Role;
  members: Member[];
  permissions: Permission[];
  roleDefaults: RoleDefault[];
  invites: Invite[];
  services: Svc[];
  serviceCounts: Record<string, number>;
  canSeeFinance: boolean;
  salon: SalonInfo;
}) {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [counts, setCounts] = useState<Record<string, number>>(serviceCounts);
  const [editing, setEditing] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("professional");
  const [commission, setCommission] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canManage = myRole === "owner" || myRole === "manager";

  const inviteLink = (token: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/convite/${token}`
      : `/convite/${token}`;

  /** Abre o WhatsApp com a mensagem do convite + link prontos. */
  function shareWhatsApp(inv: Invite) {
    const link = inviteLink(inv.token);
    const msg = `Olá! Você foi convidado(a) para a equipe do ${salon.name} 💈\nCrie seu acesso por aqui: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  async function createInvite() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("create_invite", {
      p_salon: salonId,
      p_email: email,
      p_role: role,
      p_commission: Number(commission) || 0,
    });
    setBusy(false);
    if (error) {
      setErr(
        error.message.includes("already_member")
          ? "Essa pessoa já faz parte da equipe."
          : "Não foi possível criar o convite.",
      );
      return;
    }
    const inv = data as Invite;
    setInvites((x) => [inv, ...x.filter((i) => i.id !== inv.id)]);
    setEmail(""); setCommission("0"); setAdding(false);
    // abre o WhatsApp já com a mensagem do convite
    shareWhatsApp(inv);
  }

  async function revokeInvite(inv: Invite) {
    if (!confirm(`Cancelar o convite de ${inv.email}?`)) return;
    setErr(null);
    const prev = invites;
    setInvites((x) => x.filter((i) => i.id !== inv.id));
    const { error } = await supabase.rpc("revoke_invite", { p_id: inv.id });
    if (error) { setInvites(prev); setErr("Não foi possível cancelar o convite. Tente novamente."); }
  }

  async function changeRole(member: Member, newRole: Role) {
    setErr(null);
    const prev = members;
    setMembers((m) => m.map((x) => (x.id === member.id ? { ...x, role: newRole } : x)));
    const { error } = await supabase.from("salon_members").update({ role: newRole }).eq("id", member.id);
    if (error) { setMembers(prev); setErr("Não foi possível alterar o cargo. Tente novamente."); }
  }

  async function deactivate(member: Member) {
    if (!confirm(`Remover ${member.profiles?.full_name ?? "esta pessoa"} da equipe?`)) return;
    setErr(null);
    const prev = members;
    setMembers((m) => m.filter((x) => x.id !== member.id));
    const { error } = await supabase.from("salon_members").delete().eq("id", member.id);
    if (error) { setMembers(prev); setErr("Não foi possível remover — a pessoa pode ter agendamentos vinculados."); }
  }

  return (
    <div className="space-y-6 af-rise">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Equipe</h1>
          <p className="text-muted-foreground text-sm">Dados, serviços e permissões de cada pessoa.</p>
        </div>
        {canManage && (
          <Button onClick={() => { setAdding((v) => !v); setErr(null); }}>
            <UserPlus className="h-4 w-4" /> Convidar
          </Button>
        )}
      </div>

      {/* Erros de ações fora do formulário (revogar, cargo, remover) */}
      {err && !adding && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <Warning className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <AnimatePresence>
        {adding && (
          <MotionModal key="invite" onClose={() => setAdding(false)}>
            <Card className="w-full sm:max-w-lg mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold">Convidar pessoa</h3>
                <button onClick={() => setAdding(false)} className="p-1 rounded hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="email">E-mail da pessoa</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="funcionaria@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Cargo</Label>
                  <Select id="role" value={role} onValueChange={(v) => setRole(v as Role)}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="commission">Comissão geral (%)</Label>
                  <Input
                    id="commission"
                    inputMode="decimal"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                A pessoa recebe um link, cria a conta e preenche os próprios dados.
                A <b>comissão geral</b> vale para todos os atendimentos dela; depois, se quiser, você
                pode definir uma comissão diferente por serviço na aba <b>Serviços</b>. Horários e
                comissão ficam sob seu controle.
              </p>
              {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
              <div className="flex gap-2 mt-5">
                <Button onClick={createInvite} disabled={busy || !email} className="flex-1">
                  {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <LinkSimple className="h-4 w-4" />}
                  Gerar link de convite
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </Card>
          </MotionModal>
        )}
      </AnimatePresence>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Convites pendentes
          </p>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-card p-3.5"
            >
              <span className="grid place-items-center h-10 w-10 rounded-full bg-secondary text-secondary-foreground shrink-0">
                <Envelope className="h-4.5 w-4.5" />
              </span>
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-medium truncate">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[inv.role]} · comissão {Number(inv.commission_percent)}% · aguardando aceite
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <Button variant="outline" size="sm" onClick={() => shareWhatsApp(inv)}>
                    <ShareNetwork className="h-4 w-4" /> WhatsApp
                  </Button>
                  <button
                    onClick={() => revokeInvite(inv)}
                    className="p-2 text-muted-foreground hover:text-red-600"
                    title="Cancelar convite"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
            <MemberAvatar member={m} />
            <div className="flex-1 min-w-[140px]">
              <p className="font-medium flex items-center gap-1.5">
                {m.display_name ?? m.profiles?.full_name ?? "—"}
                {m.role === "owner" && <Crown className="h-4 w-4 text-accent" />}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {m.profiles?.email}
                {m.role !== "owner" && (counts[m.id] ?? 0) > 0 && (
                  <> · {counts[m.id]} serviço{counts[m.id] > 1 ? "s" : ""}</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1 ml-auto shrink-0">
              {m.role === "owner" ? (
                <>
                  <span className="text-xs rounded-full bg-secondary text-secondary-foreground px-3 py-1 font-medium">
                    {ROLE_LABEL.owner}
                  </span>
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                      <PencilSimple className="h-4 w-4" /> Editar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {canManage ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => changeRole(m, v as Role)}
                      className="w-auto h-9 text-sm"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                  )}
                  {canManage && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                        <PencilSimple className="h-4 w-4" /> Editar
                      </Button>
                      <button
                        onClick={() => deactivate(m)}
                        className="p-2 text-muted-foreground hover:text-red-600"
                        title="Remover"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <MemberEditor
            key="member-editor"
            member={editing}
            salonId={salonId}
            services={services}
            permissions={permissions}
            roleDefaults={roleDefaults}
            canSeeFinance={canSeeFinance}
            salon={salon}
            onClose={() => setEditing(null)}
            onMemberSaved={(patch) =>
              setMembers((ms) => ms.map((x) => (x.id === editing.id ? { ...x, ...patch } : x)))
            }
            onServicesSaved={(count) =>
              setCounts((c) => ({ ...c, [editing.id]: count }))
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Avatar (foto ou cor + inicial) ─────────────────────────────── */
function MemberAvatar({ member, size = 44 }: { member: Member; size?: number }) {
  const name = member.display_name ?? member.profiles?.full_name ?? "?";
  if (member.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.photo_url}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-full text-white font-semibold shrink-0"
      style={{ height: size, width: size, background: member.color || "var(--primary)" }}
    >
      {name.charAt(0)}
    </span>
  );
}

/* ── Modal único com abas: Dados · Cadastro · Serviços · Finanças · Permissões */
type Tab = "dados" | "cadastro" | "servicos" | "financas" | "permissoes";

function MemberEditor({
  member, salonId, services, permissions, roleDefaults, canSeeFinance, salon,
  onClose, onMemberSaved, onServicesSaved,
}: {
  member: Member;
  salonId: string;
  services: Svc[];
  permissions: Permission[];
  roleDefaults: RoleDefault[];
  canSeeFinance: boolean;
  salon: SalonInfo;
  onClose: () => void;
  onMemberSaved: (patch: Partial<Member>) => void;
  onServicesSaved: (count: number) => void;
}) {
  const isOwner = member.role === "owner";
  const [tab, setTab] = useState<Tab>("dados");
  const tabs: { id: Tab; label: string; icon: typeof User }[] = isOwner
    ? [
        { id: "dados", label: "Dados", icon: User },
        { id: "servicos", label: "Serviços", icon: Scissors },
      ]
    : [
        { id: "dados", label: "Dados", icon: User },
        { id: "cadastro", label: "Cadastro", icon: FileText },
        { id: "servicos", label: "Serviços", icon: Scissors },
        ...(canSeeFinance ? [{ id: "financas" as Tab, label: "Finanças", icon: Wallet }] : []),
        { id: "permissoes", label: "Permissões", icon: ShieldCheck },
      ];

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-lg mx-auto h-[600px] max-h-[88vh] flex flex-col p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-display text-lg font-bold">
            {member.display_name ?? member.profiles?.full_name ?? "Profissional"}
          </h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {/* Abas — mobile: pílulas (ícone + rótulo na ativa);
            desktop: ícone em cima, rótulo abaixo, distribuídas uniformemente */}
        <div className="flex gap-1.5 px-5 border-b border-border overflow-x-auto no-scrollbar pb-2 sm:gap-0 sm:pb-0 sm:px-0">
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "transition shrink-0 font-medium whitespace-nowrap",
                  // Mobile: pílula horizontal
                  "flex items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm",
                  on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  // Desktop: coluna ícone + label, flex-1 para distribuir
                  "sm:flex-1 sm:flex-col sm:items-center sm:gap-1 sm:rounded-none sm:-mb-px sm:border-b-2 sm:px-2 sm:py-2.5 sm:bg-transparent",
                  on
                    ? "sm:border-primary sm:text-primary"
                    : "sm:border-transparent sm:text-muted-foreground sm:hover:bg-muted/50 sm:hover:text-foreground",
                )}
              >
                <t.icon className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" />
                <span className={cn(
                  "leading-none",
                  // Mobile: só mostra na ativa
                  on ? "inline" : "hidden",
                  // Desktop: sempre visível, fonte menor
                  "sm:inline sm:text-[11px]",
                )}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {tab === "dados" && (
            <DadosPanel member={member} salonId={salonId} onSaved={onMemberSaved} />
          )}
          {tab === "cadastro" && (
            <CadastroPanel member={member} salonId={salonId} />
          )}
          {tab === "servicos" && (
            <ServicesPanel member={member} services={services} salonId={salonId} onSaved={onServicesSaved} />
          )}
          {tab === "financas" && (
            <FinancasPanel member={member} salonId={salonId} salon={salon} />
          )}
          {tab === "permissoes" && (
            <PermissionsPanel member={member} permissions={permissions} roleDefaults={roleDefaults} />
          )}
        </div>
      </Card>
    </MotionModal>
  );
}

/* ── Aba Dados: foto, nome de exibição, bio, cor ────────────────── */
function DadosPanel({ member, salonId, onSaved }: { member: Member; salonId: string; onSaved: (patch: Partial<Member>) => void }) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(member.display_name ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [color, setColor] = useState(member.color ?? AVATAR_COLORS[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(member.photo_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      // 1) Comprime/redimensiona no navegador (fotos grandes de celular → ~512px JPEG).
      const blob = await compressImage(file);
      // 2) Sobe pelo servidor (admin client) — o upload direto do navegador é
      //    barrado pela RLS do Storage. A action grava photo_url no banco.
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await uploadMemberPhoto(salonId, member.id, form);
      if ("error" in res) {
        setErr(`Não foi possível enviar a foto: ${res.error}`);
        return;
      }
      setPhotoUrl(res.url);
      onSaved({ photo_url: res.url });
    } catch {
      setErr("Não consegui processar essa imagem. Tente uma foto JPG ou PNG.");
    } finally {
      setUploading(false);
      e.target.value = ""; // permite reenviar o mesmo arquivo
    }
  }

  async function removePhoto() {
    setUploading(true); setErr(null);
    const res = await removeMemberPhoto(salonId, member.id);
    setUploading(false);
    if ("error" in res) { setErr(res.error); return; }
    setPhotoUrl(null);
    onSaved({ photo_url: null });
  }

  async function save() {
    setSaving(true); setErr(null); setOk(false);
    const patch = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      color,
      photo_url: photoUrl,
    };
    const { error } = await supabase.from("salon_members").update(patch).eq("id", member.id);
    setSaving(false);
    if (error) { setErr("Não foi possível salvar os dados. Tente novamente."); return; }
    onSaved(patch);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }

  return (
    <div className="space-y-5">
      {/* Foto */}
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Foto" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full text-white text-xl font-semibold" style={{ background: color }}>
            {(displayName || member.profiles?.full_name || "?").charAt(0)}
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm hover:bg-muted">
            {uploading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {photoUrl ? "Trocar foto" : "Enviar foto"}
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} disabled={uploading} />
          </label>
          {photoUrl && (
            <button onClick={removePhoto} disabled={uploading} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 disabled:opacity-50">
              <Trash className="h-3.5 w-3.5" /> Remover foto
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dn">Nome de exibição</Label>
        <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Como aparece para os clientes" />
        <p className="text-xs text-muted-foreground">É o nome que o cliente vê no agendamento.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Mini-bio</Label>
        <Textarea id="bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ex.: Especialista em coloração e cortes femininos" />
      </div>

      {/* Cor do avatar (usada quando não há foto) */}
      <div className="space-y-1.5">
        <Label>Cor do avatar</Label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving || uploading}>
          {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar dados
        </Button>
        {ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Salvo</span>}
      </div>
    </div>
  );
}

/* ── Aba Cadastro: documentos, endereço e vínculo de trabalho ───── */
type Details = Tables<"salon_member_details">;

const EMPLOYMENT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "clt", label: "CLT (registrado)", hint: "Funcionário com carteira assinada." },
  { value: "autonomo", label: "Autônomo", hint: "Presta serviço por conta própria." },
  { value: "chair_rent", label: "Aluguel de cadeira", hint: "Paga um valor pelo espaço, não recebe comissão." },
  { value: "freelancer", label: "Freelancer / diarista", hint: "Trabalha por demanda ou diária." },
  { value: "other", label: "Outro", hint: "" },
];

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

/** CPF mascarado 000.000.000-00 enquanto digita. */
function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** CEP mascarado 00000-000 enquanto digita. */
function maskCEP(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

function CadastroPanel({ member, salonId }: { member: Member; salonId: string }) {
  const supabase = createClient();
  const [form, setForm] = useState<Partial<Details>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase
      .from("salon_member_details")
      .select("*")
      .eq("member_id", member.id)
      .maybeSingle()
      .then(({ data }) => {
        setForm(data ?? {});
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  function set<K extends keyof Details>(k: K, v: Details[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /** Busca rua/bairro/cidade/UF pelo CEP (ViaCEP). Não bloqueia se falhar. */
  async function lookupCep(raw: string) {
    const cep = onlyDigits(raw);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch {
      /* silencioso — o usuário pode preencher manualmente */
    } finally {
      setCepLoading(false);
    }
  }

  async function save() {
    setSaving(true); setErr(null); setOk(false);
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
      member_id: member.id,
      salon_id: salonId,
      employment_type: form.employment_type || null,
      chair_rent_amount:
        form.employment_type === "chair_rent" && form.chair_rent_amount != null
          ? form.chair_rent_amount
          : null,
      chair_rent_due_day:
        form.employment_type === "chair_rent" && form.chair_rent_due_day
          ? form.chair_rent_due_day
          : null,
      cpf: form.cpf || null,
      rg: form.rg || null,
      birth_date: form.birth_date || null,
      personal_phone: form.personal_phone || null,
      zip: form.zip || null,
      street: form.street || null,
      number: form.number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      contract_signed: form.contract_signed ?? false,
      contract_signed_at: form.contract_signed ? (form.contract_signed_at || null) : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
      updated_by: userRes.user?.id ?? null,
    };
    const { error } = await supabase
      .from("salon_member_details")
      .upsert(payload, { onConflict: "member_id" });
    setSaving(false);
    if (error) { setErr("Não foi possível salvar o cadastro. Tente novamente."); return; }
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }

  if (!loaded) {
    return <div className="py-10 grid place-items-center"><CircleNotch className="h-6 w-6 animate-spin" /></div>;
  }

  const isChairRent = form.employment_type === "chair_rent";

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Informações pessoais e de vínculo. Visível apenas para você (proprietária/gerente).
      </p>

      {/* Vínculo de trabalho */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> Vínculo de trabalho</h4>
        <div className="space-y-1.5">
          <Label htmlFor="emp">Tipo de acordo</Label>
          <Select
            id="emp"
            value={form.employment_type ?? ""}
            onValueChange={(v) => set("employment_type", v || null)}
          >
            <option value="">Não definido</option>
            {EMPLOYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          {form.employment_type && (
            <p className="text-xs text-muted-foreground">
              {EMPLOYMENT_OPTIONS.find((o) => o.value === form.employment_type)?.hint}
            </p>
          )}
        </div>

        {isChairRent && (
          <div className="grid sm:grid-cols-2 gap-3 rounded-[var(--radius)] border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="rent"><Armchair className="inline h-3.5 w-3.5 mr-1" />Valor do aluguel (R$)</Label>
              <Input
                id="rent"
                inputMode="decimal"
                value={form.chair_rent_amount ?? ""}
                onChange={(e) => set("chair_rent_amount", e.target.value === "" ? null : Number(e.target.value.replace(",", ".")))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Dia do vencimento</Label>
              <Input
                id="due"
                type="number"
                min={1}
                max={28}
                value={form.chair_rent_due_day ?? ""}
                onChange={(e) => set("chair_rent_due_day", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="Ex.: 5"
              />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              No aluguel de cadeira o profissional paga pelo espaço e <b>não recebe comissão</b>: o sistema já zera automaticamente a comissão dele em atendimentos e pacotes, mesmo que o serviço tenha comissão padrão.
            </p>
          </div>
        )}
      </section>

      {/* Documentos */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Documentos</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" value={form.cpf ?? ""} onChange={(e) => set("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg">RG</Label>
            <Input id="rg" value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} placeholder="00.000.000-0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd">Nascimento</Label>
            <Input id="bd" type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph">Telefone pessoal</Label>
            <Input id="ph" value={form.personal_phone ?? ""} onChange={(e) => set("personal_phone", e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Endereço</h4>
        <div className="grid sm:grid-cols-6 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cep">CEP</Label>
            <div className="relative">
              <Input
                id="cep"
                value={form.zip ?? ""}
                onChange={(e) => set("zip", maskCEP(e.target.value))}
                onBlur={(e) => lookupCep(e.target.value)}
                placeholder="00000-000"
              />
              {cepLoading && <CircleNotch className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="street">Rua</Label>
            <Input id="street" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} placeholder="Rua / Avenida" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="num">Número</Label>
            <Input id="num" value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} placeholder="Nº" />
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="comp">Complemento</Label>
            <Input id="comp" value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} placeholder="Apto, bloco..." />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="bairro">Bairro</Label>
            <Input id="bairro" value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="uf">UF</Label>
            <Select id="uf" value={form.state ?? ""} onValueChange={(v) => set("state", v || null)}>
              <option value="">—</option>
              {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
          </div>
        </div>
      </section>

      {/* Contrato */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Contrato</h4>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.contract_signed ?? false}
            onChange={(e) => set("contract_signed", e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm">Contrato assinado</span>
        </label>
        {form.contract_signed && (
          <div className="space-y-1.5 max-w-[220px]">
            <Label htmlFor="csa">Data da assinatura</Label>
            <Input id="csa" type="date" value={form.contract_signed_at ?? ""} onChange={(e) => set("contract_signed_at", e.target.value || null)} />
          </div>
        )}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Anotações internas sobre o profissional" />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving}>
          {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar cadastro
        </Button>
        {ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Salvo</span>}
      </div>
    </div>
  );
}

/* ── Aba Finanças (comissões a pagar/receber) ───────────────────── */
/**
 * Resumo financeiro do profissional. Mostra, para o MÊS ATUAL, a mesma conta
 * usada em Caixa & Comissões:
 *   a receber = comissões apuradas (atendimentos concluídos + pacotes) − já pago.
 *
 * Já funciona (somente leitura). As ações de fato (dar baixa/registrar
 * pagamento, histórico por mês, recibo e a visão do próprio profissional)
 * ficam planejadas abaixo — ver lista "Em breve".
 */
type Payment = { id: string; amount: number; period_start: string; created_at: string };

function FinancasPanel({ member, salonId, salon }: { member: Member; salonId: string; salon: SalonInfo }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [earned, setEarned] = useState(0);
  const [paid, setPaid] = useState(0);
  const [history, setHistory] = useState<Payment[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastPaid, setLastPaid] = useState<number | null>(null);

  const name = member.display_name ?? member.profiles?.full_name ?? "profissional";

  function periodLabelOf(periodStart: string) {
    return new Date(`${periodStart.slice(0, 7)}-01T12:00:00`).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }

  async function downloadReceipt(amount: number, dateLabel: string, periodLabel: string) {
    const safe = name.replace(/\s+/g, "-").toLowerCase();
    await generateCommissionReceiptPdf(
      { professional: name, amount, periodLabel, dateLabel, fileBase: `comissao-${safe}-${periodLabel.replace(/\s+/g, "-")}` },
      salon,
    );
  }
  const ym = currentMonthBR();
  const [py, pm] = ym.split("-").map(Number);
  const periodStart = `${ym}-01`;
  const periodEnd = `${ym}-${String(new Date(py, pm, 0).getDate()).padStart(2, "0")}`;
  const monthLabel = new Date(`${ym}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  async function load() {
    setLoading(true);
    const { start, end } = monthRangeBR(ym);
    const [svc, red, paysMonth, hist] = await Promise.all([
      supabase
        .from("appointment_services")
        .select("commission_amount, appointments!inner(member_id, status, starts_at)")
        .eq("salon_id", salonId)
        .eq("appointments.member_id", member.id)
        .eq("appointments.status", "completed")
        .gte("appointments.starts_at", start)
        .lte("appointments.starts_at", end),
      supabase
        .from("package_redemptions")
        .select("commission_amount")
        .eq("salon_id", salonId)
        .eq("member_id", member.id)
        .gte("used_at", start)
        .lte("used_at", end),
      supabase
        .from("commission_payments")
        .select("amount")
        .eq("salon_id", salonId)
        .eq("member_id", member.id)
        .eq("period_start", periodStart),
      supabase
        .from("commission_payments")
        .select("id, amount, period_start, created_at")
        .eq("salon_id", salonId)
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const e1 = (svc.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);
    const e2 = (red.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);
    const p = (paysMonth.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const total = e1 + e2;
    setEarned(total);
    setPaid(p);
    setHistory((hist.data ?? []) as Payment[]);
    setPayAmount(Math.max(0, total - p).toFixed(2));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id, salonId, ym]);

  const toReceive = Math.max(0, earned - paid);

  async function pay() {
    const value = parseFloat(payAmount.replace(",", "."));
    if (!value || value <= 0) { setErr("Informe um valor válido."); return; }
    if (!confirm(`Registrar pagamento de ${formatBRL(value)} para ${name}?`)) return;
    setPaying(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.rpc("pay_commission", {
      p_salon: salonId,
      p_member: member.id,
      p_amount: value,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    setPaying(false);
    if (error) {
      setErr(
        error.message.includes("forbidden")
          ? "Você não tem permissão para registrar pagamentos de comissão."
          : "Não foi possível registrar o pagamento. Tente novamente.",
      );
      return;
    }
    const cashRecorded = (data as { cash_recorded?: boolean } | null)?.cash_recorded;
    setMsg(cashRecorded ? "Pagamento registrado e lançado no caixa." : "Pagamento registrado.");
    setLastPaid(value);
    await load();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" /> Comissões de <span className="font-medium capitalize">{monthLabel}</span>
      </p>

      {loading ? (
        <div className="py-10 grid place-items-center"><CircleNotch className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Apurado" value={formatBRL(earned)} />
            <StatCard label="Já pago" value={formatBRL(paid)} />
            <StatCard label="A receber" value={formatBRL(toReceive)} highlight />
          </div>
          <p className="text-xs text-muted-foreground">
            Mesma base de <b>Caixa &amp; Comissões</b>: atendimentos concluídos e uso de pacotes no mês, menos o que já foi pago.
          </p>

          {/* Registrar pagamento (dá baixa e lança no caixa, se aberto) */}
          <div className="rounded-[var(--radius)] border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Registrar pagamento</p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="pay">Valor</Label>
                <Input
                  id="pay"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <Button onClick={pay} disabled={paying || toReceive <= 0}>
                {paying ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Pagar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se o caixa estiver aberto, isso lança uma saída de comissão automaticamente.
            </p>
            {err && <p className="text-sm text-red-600">{err}</p>}
            {msg && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> {msg}</p>
                {lastPaid != null && (
                  <button
                    onClick={() => downloadReceipt(lastPaid, new Date().toLocaleDateString("pt-BR"), monthLabel)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <DownloadSimple className="h-4 w-4" /> Baixar recibo
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Histórico de pagamentos */}
          {history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamentos recentes</p>
              {history.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatBRL(Number(p.amount))}</span>
                    <button
                      onClick={() =>
                        downloadReceipt(
                          Number(p.amount),
                          new Date(p.created_at).toLocaleDateString("pt-BR"),
                          periodLabelOf(p.period_start),
                        )
                      }
                      className="text-muted-foreground hover:text-primary"
                      title="Baixar recibo"
                    >
                      <DownloadSimple className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[var(--radius)] border p-3 text-center ${highlight ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-bold ${highlight ? "text-primary text-lg" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

/* ── Compressão de imagem no cliente (para avatares) ────────────── */
/**
 * Redimensiona para no máx. `maxDim` px no maior lado e exporta JPEG.
 * Fotos grandes de celular (5–12MB) viram ~50–150KB, o que evita limites
 * de upload e deixa o avatar leve. Lança erro se a imagem não decodificar
 * (ex.: formatos não suportados pelo navegador).
 */
async function compressImage(file: File, maxDim = 512, quality = 0.85): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read_failed"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode_failed"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/* ── Aba Serviços ───────────────────────────────────────────────── */
function ServicesPanel({
  member, services, salonId, onSaved,
}: {
  member: Member;
  services: Svc[];
  salonId: string;
  onSaved: (count: number) => void;
}) {
  const supabase = createClient();
  const [state, setState] = useState<Record<string, { on: boolean; commission: string }>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase
      .from("professional_services")
      .select("service_id, commission_percent")
      .eq("member_id", member.id)
      .then(({ data }) => {
        const s: Record<string, { on: boolean; commission: string }> = {};
        for (const r of data ?? []) {
          s[r.service_id] = {
            on: true,
            commission: r.commission_percent != null ? String(r.commission_percent) : "",
          };
        }
        setState(s);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  function toggle(id: string) {
    setState((s) => ({ ...s, [id]: { on: !(s[id]?.on), commission: s[id]?.commission ?? "" } }));
  }
  function setComm(id: string, v: string) {
    setState((s) => ({ ...s, [id]: { on: s[id]?.on ?? true, commission: v } }));
  }

  const selectedCount = services.filter((sv) => state[sv.id]?.on).length;

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(false);

    const { data: prevRows } = await supabase
      .from("professional_services")
      .select("salon_id, member_id, service_id, commission_percent")
      .eq("member_id", member.id);

    const { error: delErr } = await supabase.from("professional_services").delete().eq("member_id", member.id);
    if (delErr) { setErr("Não foi possível salvar. Tente novamente."); setSaving(false); return; }

    const rows = services
      .filter((sv) => state[sv.id]?.on)
      .map((sv) => {
        const c = state[sv.id]?.commission;
        return {
          salon_id: salonId,
          member_id: member.id,
          service_id: sv.id,
          commission_percent: c ? parseFloat(c.replace(",", ".")) : null,
        };
      });
    if (rows.length) {
      const { error: insErr } = await supabase.from("professional_services").insert(rows);
      if (insErr) {
        if (prevRows?.length) await supabase.from("professional_services").insert(prevRows);
        setErr("Não foi possível salvar os serviços. Nada foi alterado.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
    onSaved(rows.length);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground space-y-2">
        <p className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary shrink-0" />
          Marque os serviços que essa pessoa faz — assim ela aparece na agenda só nesses serviços.
        </p>
        <p className="rounded-[var(--radius)] bg-muted/60 px-3 py-2 text-xs">
          O campo de <b>%</b> é uma comissão <b>só para aquele serviço</b> (exceção). Deixe em
          branco para usar a comissão padrão — primeiro a do serviço, depois a comissão geral do
          profissional.
        </p>
      </div>

      {!loaded ? (
        <div className="py-10 grid place-items-center"><CircleNotch className="h-6 w-6 animate-spin" /></div>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum serviço cadastrado. Crie serviços primeiro.
        </p>
      ) : (
        <div className="space-y-1.5">
          {services.map((sv) => {
            const on = state[sv.id]?.on ?? false;
            return (
              <div key={sv.id} className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 hover:bg-muted">
                <button
                  type="button"
                  onClick={() => toggle(sv.id)}
                  className={`relative h-6 w-11 rounded-full transition shrink-0 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
                  aria-pressed={on}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className="flex-1 text-sm">{sv.name}</span>
                {on && (
                  <div className="flex items-center gap-1">
                    <Input
                      value={state[sv.id]?.commission ?? ""}
                      onChange={(e) => setComm(sv.id, e.target.value)}
                      placeholder={sv.commission_percent != null ? String(sv.commission_percent) : "%"}
                      className="w-16 h-8 text-sm text-center"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving}>
          {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar {selectedCount > 0 ? `(${selectedCount})` : ""}
        </Button>
        {ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Salvo</span>}
      </div>
    </div>
  );
}

/* ── Aba Permissões ─────────────────────────────────────────────── */
function PermissionsPanel({
  member, permissions, roleDefaults,
}: {
  member: Member;
  permissions: Permission[];
  roleDefaults: RoleDefault[];
}) {
  const supabase = createClient();
  const defaults = new Set(
    roleDefaults.filter((r) => r.role === member.role && r.allowed).map((r) => r.permission_key),
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase
      .from("member_permissions")
      .select("permission_key, allowed")
      .eq("member_id", member.id)
      .then(({ data }) => {
        const o: Record<string, boolean> = {};
        for (const r of data ?? []) o[r.permission_key] = r.allowed;
        setOverrides(o);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  function isOn(key: string) {
    if (key in overrides) return overrides[key];
    return defaults.has(key);
  }
  function toggle(key: string) {
    setOverrides((o) => ({ ...o, [key]: !isOn(key) }));
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(false);
    const rows = permissions.map((p) => ({
      member_id: member.id,
      permission_key: p.key,
      allowed: isOn(p.key),
    }));
    const { error } = await supabase
      .from("member_permissions")
      .upsert(rows, { onConflict: "member_id,permission_key" });
    if (error) { setErr("Não foi possível salvar as permissões. Tente novamente."); setSaving(false); return; }
    setSaving(false);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" /> Cargo {ROLE_LABEL[member.role]}
      </p>

      {!loaded ? (
        <div className="py-10 grid place-items-center"><CircleNotch className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, perms]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1">
                {perms.map((p) => {
                  const on = isOn(p.key);
                  const isDefault = !(p.key in overrides);
                  return (
                    <label key={p.key} className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 hover:bg-muted cursor-pointer">
                      <button
                        type="button"
                        onClick={() => toggle(p.key)}
                        className={`relative h-6 w-11 rounded-full transition shrink-0 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                      <span className="flex-1 text-sm">{p.label}</span>
                      {!isDefault && <span className="text-[10px] text-accent font-medium">personalizado</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving}>
          {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar permissões
        </Button>
        {ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Salvo</span>}
      </div>
    </div>
  );
}
