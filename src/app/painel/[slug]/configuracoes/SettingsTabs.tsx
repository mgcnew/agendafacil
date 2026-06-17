"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { Select } from "@/components/Select";
import { cn } from "@/lib/utils";
import { COLOR_GROUPS, CHOOSABLE_NICHES, type ColorTheme, type Niche } from "@/lib/themes";
import type { Tables } from "@/lib/database.types";
import { HoursManager } from "../horarios/HoursManager";
import {
  Store,
  Clock,
  Link2,
  Palette,
  Copy,
  Check,
  Loader2,
  ImageIcon,
  ShieldCheck,
  Upload,
  Trash2,
} from "lucide-react";

type Pro = { id: string; name: string };
type TabId = "estabelecimento" | "horarios" | "agendamento" | "aparencia" | "acessos";
type Role = "manager" | "professional" | "receptionist";
type Perm = { key: string; label: string; category: string };
type RolePerm = { role: string; permission_key: string; allowed: boolean };

const TAB_META: { id: TabId; label: string; icon: typeof Store; need: "salon" | "schedule" | "team" }[] = [
  { id: "estabelecimento", label: "Estabelecimento", icon: Store, need: "salon" },
  { id: "horarios", label: "Horários", icon: Clock, need: "schedule" },
  { id: "agendamento", label: "Agendamento", icon: Link2, need: "salon" },
  { id: "acessos", label: "Acessos", icon: ShieldCheck, need: "team" },
  { id: "aparencia", label: "Aparência", icon: Palette, need: "salon" },
];

export function SettingsTabs({
  salon,
  canEditSalon,
  canManageSalon,
  canManageSchedule,
  canManageTeam,
  pros,
  initialHours,
  initialTab,
  permissions,
  roleDefaults,
  salonRolePerms,
}: {
  salon: Tables<"salons">;
  canEditSalon: boolean;
  canManageSalon: boolean;
  canManageSchedule: boolean;
  canManageTeam: boolean;
  pros: Pro[];
  initialHours: Tables<"working_hours">[];
  initialTab?: string;
  permissions: Perm[];
  roleDefaults: RolePerm[];
  salonRolePerms: RolePerm[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = useMemo(
    () =>
      TAB_META.filter((t) =>
        t.need === "schedule" ? canManageSchedule : t.need === "team" ? canManageTeam : canManageSalon,
      ),
    [canManageSalon, canManageSchedule, canManageTeam],
  );

  const validInitial = tabs.find((t) => t.id === initialTab)?.id;
  const [active, setActive] = useState<TabId>(validInitial ?? tabs[0]?.id ?? "estabelecimento");

  function selectTab(id: TabId) {
    setActive(id);
    router.replace(`${pathname}?tab=${id}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Dados do salão, horários, agendamento e aparência.
        </p>
      </div>

      {/* Barra de tabs — mobile: pílulas com ícone (a ativa expande o rótulo);
          desktop: abas sublinhadas com ícone + texto */}
      <div className="flex gap-1.5 border-b border-border overflow-x-auto no-scrollbar pb-2 sm:gap-1 sm:pb-0">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              aria-label={t.label}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center justify-center gap-2 font-medium whitespace-nowrap transition shrink-0",
                // Mobile (pílula)
                "rounded-full px-3.5 py-2 text-sm",
                on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                // Desktop (aba sublinhada) — sobrescreve o visual de pílula
                "sm:rounded-none sm:-mb-px sm:border-b-2 sm:px-3.5 sm:py-2.5 sm:bg-transparent",
                on
                  ? "sm:border-primary sm:text-primary"
                  : "sm:border-transparent sm:hover:bg-transparent sm:hover:text-foreground",
              )}
            >
              <t.icon className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" />
              <span className={cn("leading-none", on ? "inline" : "hidden", "sm:inline")}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Painel ativo */}
      {active === "estabelecimento" && (
        <EstablishmentPanel salon={salon} canEdit={canEditSalon} />
      )}
      {active === "horarios" && (
        <HoursManager salonId={salon.id} pros={pros} initialHours={initialHours} embedded />
      )}
      {active === "agendamento" && (
        <BookingPanel salon={salon} canEdit={canEditSalon} />
      )}
      {active === "aparencia" && (
        <AppearancePanel salon={salon} canEdit={canEditSalon} />
      )}
      {active === "acessos" && (
        <AccessPanel
          salonId={salon.id}
          permissions={permissions}
          roleDefaults={roleDefaults}
          salonRolePerms={salonRolePerms}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Acessos (permissões por cargo) ───────────────────────── */

const ROLE_LABELS: Record<Role, string> = {
  manager: "Gerente",
  professional: "Profissional",
  receptionist: "Recepção",
};

function AccessPanel({
  salonId,
  permissions,
  roleDefaults,
  salonRolePerms,
}: {
  salonId: string;
  permissions: Perm[];
  roleDefaults: RolePerm[];
  salonRolePerms: RolePerm[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("manager");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // estado efetivo inicial por cargo: default global ⊕ ajuste do salão
  const initialFor = (r: Role) => {
    const map: Record<string, boolean> = {};
    for (const rd of roleDefaults) if (rd.role === r) map[rd.permission_key] = rd.allowed;
    for (const sr of salonRolePerms) if (sr.role === r) map[sr.permission_key] = sr.allowed;
    return map;
  };

  const [state, setState] = useState<Record<Role, Record<string, boolean>>>({
    manager: initialFor("manager"),
    professional: initialFor("professional"),
    receptionist: initialFor("receptionist"),
  });

  function toggle(key: string) {
    setState((s) => ({ ...s, [role]: { ...s[role], [key]: !s[role][key] } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    // grava o cargo atual como overrides explícitos do salão
    const rows = permissions.map((p) => ({
      salon_id: salonId,
      role,
      permission_key: p.key,
      allowed: !!state[role][p.key],
    }));
    const { error: e } = await supabase
      .from("salon_role_permissions")
      .upsert(rows, { onConflict: "salon_id,role,permission_key" });
    setSaving(false);
    if (e) {
      setError("Não foi possível salvar as permissões. Tente novamente.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  const grouped = permissions.reduce<Record<string, Perm[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="font-display font-semibold">Acessos por cargo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o que cada cargo pode fazer no seu salão. Ajustes por pessoa (exceções) ficam na página Equipe.
            A proprietária sempre tem acesso total.
          </p>
        </div>

        {/* Seletor de cargo */}
        <div className="flex gap-1 rounded-[var(--radius)] border border-border p-1 w-fit">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 text-sm font-medium rounded-[calc(var(--radius)-0.25rem)] transition ${
                role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Matriz de permissões do cargo */}
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, perms]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1">
                {perms.map((p) => {
                  const on = !!state[role][p.key];
                  return (
                    <label key={p.key} className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 hover:bg-muted cursor-pointer">
                      <button
                        type="button"
                        onClick={() => toggle(p.key)}
                        aria-pressed={on}
                        className={`relative h-6 w-11 rounded-full transition shrink-0 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                      <span className="flex-1 text-sm">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SaveBar onSave={save} saving={saving} saved={saved} error={error} />
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function SaveBar({
  onSave,
  saving,
  saved,
  error,
  disabled,
}: {
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button onClick={onSave} disabled={saving || disabled}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
      </Button>
      {saved && (
        <span className="text-sm text-emerald-600 flex items-center gap-1">
          <Check className="h-4 w-4" /> Salvo!
        </span>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

/* ───────────────────── Estabelecimento ───────────────────────── */

function EstablishmentPanel({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(salon.name);
  const [niche, setNiche] = useState<Niche>(salon.niche);
  const [email, setEmail] = useState(salon.email ?? "");
  const [phone, setPhone] = useState(salon.phone ?? "");
  const [address, setAddress] = useState(salon.address ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("salons")
      .update({
        name,
        niche,
        email: email.trim() || null,
        phone: phone || null,
        address: address || null,
      })
      .eq("id", salon.id);
    setSaving(false);
    if (e) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card className="p-6 space-y-5">
          <h2 className="font-display font-semibold">Dados do salão</h2>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="niche">Segmento</Label>
            <Select id="niche" value={niche} onValueChange={(v) => setNiche(v as Niche)} disabled={!canEdit}>
              {CHOOSABLE_NICHES.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">Define a tipografia e os serviços sugeridos.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
              placeholder="contato@seusalao.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canEdit}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </Card>

        <LogoCard salon={salon} canEdit={canEdit} />
      </div>

      <LinkCard salon={salon} canEdit={canEdit} />

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
  );
}

/* ───────────────────────── Link (slug) ───────────────────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function LinkCard({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(salon.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effective = slugify(slug);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const changed = effective !== salon.slug;

  async function save() {
    if (!effective) {
      setError("O link não pode ficar vazio.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("salons")
      .update({ slug: effective })
      .eq("id", salon.id);
    setSaving(false);
    if (e) {
      // 23505 = violação de unicidade (link já usado por outro salão)
      setError(
        e.code === "23505"
          ? "Esse link já está em uso. Escolha outro."
          : "Não foi possível salvar o link. Tente novamente.",
      );
      return;
    }
    // o slug faz parte da URL do painel — redireciona para o novo endereço
    router.push(`/painel/${effective}/configuracoes?tab=estabelecimento`);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <Link2 className="h-5 w-5 text-primary" /> Link de agendamento
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        É o endereço que suas clientes usam para agendar.
      </p>

      <div className="mt-4 flex items-center gap-1 rounded-[var(--radius)] border border-border bg-secondary/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground shrink-0">{origin}/</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={!canEdit}
          className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60"
        />
      </div>
      {effective !== slug && (
        <p className="mt-1 text-xs text-muted-foreground">
          Ficará: <strong>{origin}/{effective || "…"}</strong>
        </p>
      )}

      {canEdit && changed && (
        <div className="mt-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠️ Ao mudar o link, o endereço antigo <strong>para de funcionar</strong> —
          QR codes e links já compartilhados deixam de abrir. Avise suas clientes.
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {canEdit && (
        <Button onClick={save} disabled={saving || !changed} className="mt-4">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar link
        </Button>
      )}
    </Card>
  );
}

/* ───────────────────────────── Logo ──────────────────────────── */

const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3 MB

function LogoCard({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(salon.logo_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo depois
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem (PNG, JPG…).");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Imagem muito grande. Máximo 3 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${salon.id}.${ext}`;

    const up = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) {
      setBusy(false);
      setError("Não foi possível enviar a imagem. Tente novamente.");
      return;
    }

    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    // cache-buster para a nova logo aparecer na hora (painel e link público)
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: upErr } = await supabase
      .from("salons")
      .update({ logo_url: url })
      .eq("id", salon.id);
    setBusy(false);
    if (upErr) {
      setError("Imagem enviada, mas não foi possível salvar. Tente novamente.");
      return;
    }
    setLogoUrl(url);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("salons")
      .update({ logo_url: null })
      .eq("id", salon.id);
    setBusy(false);
    if (delErr) {
      setError("Não foi possível remover. Tente novamente.");
      return;
    }
    setLogoUrl(null);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-primary" /> Logo
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        Aparece no seu link de agendamento. PNG ou JPG, até 3 MB.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="grid place-items-center h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-secondary">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo do salão" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {canEdit && (
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPick}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {logoUrl ? "Trocar logo" : "Enviar logo"}
            </Button>
            {logoUrl && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

/* ───────────────────────── Agendamento ───────────────────────── */

function BookingPanel({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [simultaneous, setSimultaneous] = useState(salon.allow_simultaneous);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/${salon.slug}`
      : `/${salon.slug}`;

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("salons")
      .update({ allow_simultaneous: simultaneous })
      .eq("id", salon.id);
    setSaving(false);
    if (e) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5 items-start">
      <Card className="p-6">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Link de agendamento
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe com suas clientes. É por aqui que elas agendam.
        </p>
        <div className="flex gap-2 mt-4">
          <Input readOnly value={link} className="font-mono text-sm" />
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display font-semibold">Regras da agenda</h2>
        <div className="flex items-start gap-3 mt-4">
          <button
            type="button"
            onClick={() => canEdit && setSimultaneous((v) => !v)}
            disabled={!canEdit}
            aria-pressed={simultaneous}
            className={`relative h-6 w-11 rounded-full transition shrink-0 mt-0.5 disabled:opacity-60 ${
              simultaneous ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                simultaneous ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium">
              Permitir atendimentos simultâneos da mesma cliente
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ex.: escova + unha ao mesmo tempo, com profissionais diferentes. A
              profissional nunca é marcada em dois lugares; isso libera apenas a
              mesma cliente em mais de um serviço ao mesmo tempo.
            </p>
          </div>
        </div>
      </Card>
      </div>

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
  );
}

/* ────────────────────────── Aparência ────────────────────────── */

function AppearancePanel({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    (salon.color_theme ?? "a") as ColorTheme,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("salons")
      .update({ color_theme: colorTheme })
      .eq("id", salon.id);
    setSaving(false);
    if (e) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="font-display font-semibold">Paleta de cores</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O segmento define a tipografia; a cor é livre — escolha entre os 3 grupos.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
        {COLOR_GROUPS.map((group) => (
          <div key={group.id} className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">{group.label}</p>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {group.variants.map((v) => {
                const activeColor = v.id === colorTheme;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setColorTheme(v.id)}
                    aria-pressed={activeColor}
                    title={v.label}
                    className={`group relative overflow-hidden rounded-xl border text-left transition disabled:opacity-60 ${
                      activeColor
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-foreground/25"
                    }`}
                  >
                    {/* Mini-preview do tema */}
                    <div
                      className="flex h-14 items-center justify-center gap-2"
                      style={{ background: v.background }}
                    >
                      <span
                        className="h-7 w-7 rounded-full ring-1 ring-black/10"
                        style={{ background: v.primary }}
                      />
                      <span
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                        style={{ background: v.accent }}
                      />
                    </div>
                    {/* Rótulo */}
                    <div className="flex items-center justify-between gap-1 bg-card px-2.5 py-2">
                      <span className="text-xs font-medium truncate">{v.label}</span>
                      {activeColor && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        </div>
      </Card>

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
  );
}
