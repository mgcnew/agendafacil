"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import type { Tables, Enums } from "@/lib/database.types";
import {
  Loader2, ShieldCheck, X, UserPlus, Settings2, Crown,
  Copy, Check, Link2, Trash2, Mail, Scissors,
} from "lucide-react";

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

export function TeamManager({
  salonId,
  myRole,
  members: initialMembers,
  permissions,
  roleDefaults,
  invites: initialInvites,
  services,
  serviceCounts,
}: {
  salonId: string;
  myRole: Role;
  members: Member[];
  permissions: Permission[];
  roleDefaults: RoleDefault[];
  invites: Invite[];
  services: Svc[];
  serviceCounts: Record<string, number>;
}) {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [counts, setCounts] = useState<Record<string, number>>(serviceCounts);
  const [editingServices, setEditingServices] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("professional");
  const [commission, setCommission] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canManage = myRole === "owner" || myRole === "manager";

  const inviteLink = (token: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/convite/${token}`
      : `/convite/${token}`;

  function copyLink(inv: Invite) {
    navigator.clipboard.writeText(inviteLink(inv.token));
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
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
    // já deixa o link copiado para colar no WhatsApp
    navigator.clipboard.writeText(inviteLink(inv.token));
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function revokeInvite(inv: Invite) {
    if (!confirm(`Cancelar o convite de ${inv.email}?`)) return;
    setInvites((x) => x.filter((i) => i.id !== inv.id));
    await supabase.rpc("revoke_invite", { p_id: inv.id });
  }

  async function changeRole(member: Member, newRole: Role) {
    setMembers((m) => m.map((x) => (x.id === member.id ? { ...x, role: newRole } : x)));
    await supabase.from("salon_members").update({ role: newRole }).eq("id", member.id);
  }

  async function deactivate(member: Member) {
    if (!confirm(`Remover ${member.profiles?.full_name ?? "esta pessoa"} da equipe?`)) return;
    setMembers((m) => m.filter((x) => x.id !== member.id));
    await supabase.from("salon_members").delete().eq("id", member.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Equipe</h1>
          <p className="text-muted-foreground text-sm">Cargos e permissões de cada pessoa.</p>
        </div>
        {canManage && (
          <Button onClick={() => { setAdding((v) => !v); setErr(null); }}>
            <UserPlus className="h-4 w-4" /> Convidar
          </Button>
        )}
      </div>

      {adding && (
        <Card className="p-6 space-y-4 af-rise">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="email">E-mail da pessoa</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="funcionaria@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Cargo</Label>
              <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commission">Comissão (%)</Label>
              <Input
                id="commission"
                type="number"
                min={0}
                max={100}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A pessoa recebe um link, cria a conta e preenche os próprios dados.
            Comissão e horários ficam sob seu controle.
          </p>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={createInvite} disabled={busy || !email}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Gerar link de convite
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Convites pendentes
          </p>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-card p-3.5"
            >
              <span className="grid place-items-center h-10 w-10 rounded-full bg-secondary text-secondary-foreground shrink-0">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[inv.role]} · comissão {Number(inv.commission_percent)}% · aguardando aceite
                </p>
              </div>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={() => copyLink(inv)}>
                    {copiedId === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedId === inv.id ? "Copiado" : "Copiar link"}
                  </Button>
                  <button
                    onClick={() => revokeInvite(inv)}
                    className="p-2 text-muted-foreground hover:text-red-600"
                    title="Cancelar convite"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
            <span
              className="grid place-items-center h-11 w-11 rounded-full text-white font-semibold shrink-0"
              style={{ background: m.color || "var(--primary)" }}
            >
              {(m.display_name ?? m.profiles?.full_name ?? "?").charAt(0)}
            </span>
            <div className="flex-1 min-w-0">
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

            {m.role === "owner" ? (
              <span className="text-xs rounded-full bg-secondary text-secondary-foreground px-3 py-1 font-medium">
                {ROLE_LABEL.owner}
              </span>
            ) : (
              <>
                {canManage ? (
                  <Select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
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
                    <button
                      onClick={() => setEditingServices(m)}
                      className="p-2 text-muted-foreground hover:text-primary"
                      title="Serviços que faz"
                    >
                      <Scissors className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditing(m)}
                      className="p-2 text-muted-foreground hover:text-primary"
                      title="Permissões"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
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
        ))}
      </div>

      {editing && (
        <PermissionsEditor
          member={editing}
          permissions={permissions}
          roleDefaults={roleDefaults}
          onClose={() => setEditing(null)}
        />
      )}

      {editingServices && (
        <ServicesEditor
          member={editingServices}
          services={services}
          salonId={salonId}
          onClose={() => setEditingServices(null)}
          onSaved={(count) => {
            setCounts((c) => ({ ...c, [editingServices.id]: count }));
            setEditingServices(null);
          }}
        />
      )}
    </div>
  );
}

// ── Editor de serviços que o profissional faz ────────────────────
function ServicesEditor({
  member,
  services,
  salonId,
  onClose,
  onSaved,
}: {
  member: Member;
  services: Svc[];
  salonId: string;
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const supabase = createClient();
  const [state, setState] = useState<Record<string, { on: boolean; commission: string }>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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
    // estratégia simples: remove tudo e reinsere os marcados
    await supabase.from("professional_services").delete().eq("member_id", member.id);
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
    if (rows.length) await supabase.from("professional_services").insert(rows);
    setSaving(false);
    onSaved(rows.length);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-lg max-h-[85vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" /> Serviços
          </h3>
          <button onClick={onClose} className="p-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {member.display_name ?? member.profiles?.full_name} · marque os serviços que faz.
          A comissão (%) é opcional e tem prioridade sobre a do serviço.
        </p>

        {!loaded ? (
          <div className="py-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
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

        <div className="flex gap-2 mt-6 sticky bottom-0 bg-card pt-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}

function PermissionsEditor({
  member,
  permissions,
  roleDefaults,
  onClose,
}: {
  member: Member;
  permissions: Permission[];
  roleDefaults: RoleDefault[];
  onClose: () => void;
}) {
  const supabase = createClient();
  const defaults = new Set(
    roleDefaults.filter((r) => r.role === member.role && r.allowed).map((r) => r.permission_key),
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // carrega overrides existentes
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
    // grava todos como overrides explícitos (allowed conforme estado atual)
    const rows = permissions.map((p) => ({
      member_id: member.id,
      permission_key: p.key,
      allowed: isOn(p.key),
    }));
    await supabase
      .from("member_permissions")
      .upsert(rows, { onConflict: "member_id,permission_key" });
    setSaving(false);
    onClose();
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-lg max-h-[85vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Permissões
          </h3>
          <button onClick={onClose} className="p-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {member.display_name ?? member.profiles?.full_name} · cargo {ROLE_LABEL[member.role]}
        </p>

        {!loaded ? (
          <div className="py-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
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

        <div className="flex gap-2 mt-6 sticky bottom-0 bg-card pt-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar permissões
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}
