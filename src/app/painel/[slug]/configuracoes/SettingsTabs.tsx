"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { Select } from "@/components/Select";
import { cn } from "@/lib/utils";
import { COLOR_GROUPS, CHOOSABLE_NICHES, NICHE_DEFAULT_COLOR, BARBEARIA_DEFAULT_PREVIEW, type ColorTheme, type Niche } from "@/lib/themes";
import type { Tables } from "@/lib/database.types";
import { HoursManager } from "../horarios/HoursManager";
import { onlyDigits, formatCep, isValidCep } from "@/lib/cep";
import { lookupCepAction } from "./cepActions";
import { uploadLogo, removeLogo } from "./actions";
import { PushNotificationsCard } from "./PushNotificationsCard";
import { SubscribePanel } from "../assinatura/SubscribePanel";
import type { AccessStatus } from "@/lib/subscription";
import {
  Check,
  CircleNotch,
  Clock,
  Copy,
  CreditCard,
  Image as ImageIcon,
  LinkSimple,
  MagnifyingGlass,
  MapPin,
  Palette,
  ShieldCheck,
  Storefront,
  Trash,
  UploadSimple,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";

type Pro = { id: string; name: string };
type OwnerInfo = { id: string; display_name: string | null; full_name: string | null };
type TabId = "estabelecimento" | "horarios" | "agendamento" | "caixa" | "aparencia" | "acessos" | "assinatura";
type Role = "manager" | "professional" | "receptionist";
type Perm = { key: string; label: string; category: string };
type RolePerm = { role: string; permission_key: string; allowed: boolean };

const TAB_META: { id: TabId; label: string; icon: typeof Storefront; need: "salon" | "schedule" | "team" }[] = [
  { id: "estabelecimento", label: "Estabelecimento", icon: Storefront, need: "salon" },
  { id: "horarios", label: "Horários", icon: Clock, need: "schedule" },
  { id: "agendamento", label: "Agendamento", icon: LinkSimple, need: "salon" },
  { id: "caixa", label: "Caixa", icon: Wallet, need: "salon" },
  { id: "acessos", label: "Acessos", icon: ShieldCheck, need: "team" },
  { id: "aparencia", label: "Aparência", icon: Palette, need: "salon" },
  { id: "assinatura", label: "Assinatura", icon: CreditCard, need: "salon" },
];

export function SettingsTabs({
  salon,
  owner,
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
  access,
}: {
  salon: Tables<"salons">;
  owner: OwnerInfo | null;
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
  access: AccessStatus | null;
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
        <div className="space-y-5">
          <EstablishmentPanel salon={salon} owner={owner} canEdit={canEditSalon} />
          <PushNotificationsCard salonId={salon.id} />
        </div>
      )}
      {active === "horarios" && (
        <HoursManager salonId={salon.id} pros={pros} initialHours={initialHours} embedded />
      )}
      {active === "agendamento" && (
        <BookingPanel salon={salon} canEdit={canEditSalon} />
      )}
      {active === "caixa" && (
        <CashSettingsPanel salon={salon} canEdit={canEditSalon} />
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
      {active === "assinatura" &&
        (access ? (
          <SubscribePanel
            slug={salon.slug}
            status={access.status}
            trialEndsAt={access.trial_ends_at}
            currentPeriodEnd={access.current_period_end}
            plan={access.plan}
            pendingPlan={access.pending_plan}
          />
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            Não foi possível carregar os dados da assinatura.
          </Card>
        ))}
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
        {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar alterações
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
  owner,
  canEdit,
}: {
  salon: Tables<"salons">;
  owner: OwnerInfo | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  // Colunas de endereço estruturado ainda não estão no tipo gerado — mesmo
  // padrão de cast usado no resto do painel (is_demo etc.).
  const s = salon as AddressColumns;
  const [name, setName] = useState(salon.name);
  const [niche, setNiche] = useState<Niche>(salon.niche);
  const [email, setEmail] = useState(salon.email ?? "");
  const [phone, setPhone] = useState(salon.phone ?? "");
  const [addr, setAddr] = useState<AddressState>({
    cep: s.cep ?? "",
    street: s.street ?? "",
    number: s.street_number ?? "",
    complement: s.complement ?? "",
    neighborhood: s.neighborhood ?? "",
    city: s.city ?? "",
    uf: s.state ?? "",
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    visibility: (s.address_visibility as AddressVisibility) ?? "full",
  });
  const [ownerName, setOwnerName] = useState(owner?.display_name ?? "");
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
        // `address` (texto) segue preenchido, derivado dos campos — a página
        // pública e as metatags ainda o usam como fallback legível.
        address: composeAddress(addr) || null,
        cep: onlyDigits(addr.cep) || null,
        street: addr.street.trim() || null,
        street_number: addr.number.trim() || null,
        complement: addr.complement.trim() || null,
        neighborhood: addr.neighborhood.trim() || null,
        city: addr.city.trim() || null,
        state: addr.uf.trim() || null,
        lat: addr.lat,
        lng: addr.lng,
        address_visibility: addr.visibility,
      } as never)
      .eq("id", salon.id);
    if (!e && owner && ownerName.trim() !== (owner.display_name ?? "")) {
      const { error: oe } = await supabase
        .from("salon_members")
        .update({ display_name: ownerName.trim() || null })
        .eq("id", owner.id);
      if (oe) {
        setSaving(false);
        setError("Salvei os dados, mas não consegui salvar o nome do dono.");
        return;
      }
    }
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
          <AddressFields value={addr} onChange={setAddr} disabled={!canEdit} />
          {owner && (
            <div className="space-y-1.5">
              <Label htmlFor="ownerName">Nome do dono</Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={!canEdit}
                placeholder={owner.full_name ?? "Como você quer ser chamado"}
              />
              <p className="text-xs text-muted-foreground">
                Como você aparece no salão — pode ser um apelido/vulgo.
                {owner.full_name ? ` Cadastro: ${owner.full_name}.` : ""}
              </p>
            </div>
          )}
        </Card>

        <LogoCard salon={salon} canEdit={canEdit} />
      </div>

      <LinkCard salon={salon} canEdit={canEdit} />

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
  );
}

/* ───────────────────────── Endereço ───────────────────────── */

type AddressVisibility = "full" | "neighborhood" | "hidden";

// Colunas de endereço estruturado (ainda fora do tipo gerado).
type AddressColumns = Tables<"salons"> & {
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  address_visibility: string | null;
};

type AddressState = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  uf: string;
  lat: number | null;
  lng: number | null;
  visibility: AddressVisibility;
};

/** Monta o endereço legível a partir dos campos (fallback de `address`). */
function composeAddress(a: AddressState): string {
  const linha1 = [a.street, a.number].filter((x) => x.trim()).join(", ");
  const comp = a.complement.trim();
  const bairro = a.neighborhood.trim();
  const cidadeUf = [a.city.trim(), a.uf.trim()].filter(Boolean).join(" - ");
  return [linha1, comp, bairro, cidadeUf].filter(Boolean).join(" · ");
}

const VISIBILITY_OPTIONS: { id: AddressVisibility; label: string; hint: string }[] = [
  { id: "full", label: "Endereço completo", hint: "A cliente vê rua e número na sua página." },
  { id: "neighborhood", label: "Só o bairro e a cidade", hint: "Bom pra quem atende em casa. O endereço exato fica pra depois do agendamento." },
  { id: "hidden", label: "Não mostrar endereço", hint: "Nada de localização na página pública." },
];

function AddressFields({
  value,
  onChange,
  disabled,
}: {
  value: AddressState;
  onChange: (next: AddressState) => void;
  disabled?: boolean;
}) {
  const [looking, setLooking] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const set = (patch: Partial<AddressState>) => onChange({ ...value, ...patch });

  async function buscarCep() {
    if (!isValidCep(value.cep)) {
      setCepMsg("CEP incompleto.");
      return;
    }
    setLooking(true);
    setCepMsg(null);
    const found = await lookupCepAction(value.cep);
    setLooking(false);
    if (!found) {
      setCepMsg("Não encontrei esse CEP. Você pode preencher na mão.");
      return;
    }
    // Coordenada só vem de alguns CEPs — mantém a que já existia se vier vazia.
    set({
      street: found.street ?? value.street,
      neighborhood: found.neighborhood ?? value.neighborhood,
      city: found.city ?? value.city,
      uf: found.state ?? value.uf,
      lat: found.lat ?? value.lat,
      lng: found.lng ?? value.lng,
    });
    setCepMsg(found.lat ? null : "Endereço preenchido. (Sem mapa pra este CEP — não atrapalha.)");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Endereço</h3>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cep">CEP</Label>
        <div className="flex gap-2">
          <Input
            id="cep"
            value={formatCep(value.cep)}
            onChange={(e) => set({ cep: onlyDigits(e.target.value) })}
            onBlur={() => { if (isValidCep(value.cep)) buscarCep(); }}
            disabled={disabled}
            inputMode="numeric"
            placeholder="00000-000"
            className="max-w-[160px]"
          />
          <Button type="button" variant="outline" onClick={buscarCep} disabled={disabled || looking}>
            {looking ? <CircleNotch className="h-4 w-4 animate-spin" /> : <MagnifyingGlass className="h-4 w-4" />}
            <span className="ml-1.5">Buscar</span>
          </Button>
        </div>
        {cepMsg && <p className="text-xs text-muted-foreground">{cepMsg}</p>}
      </div>

      <div className="grid grid-cols-[1fr_100px] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="street">Rua</Label>
          <Input id="street" value={value.street} onChange={(e) => set({ street: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="number">Número</Label>
          <Input id="number" value={value.number} onChange={(e) => set({ number: e.target.value })} disabled={disabled} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="complement">Complemento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Input id="complement" value={value.complement} onChange={(e) => set({ complement: e.target.value })} disabled={disabled} placeholder="Sala, andar, ponto de referência" />
      </div>

      <div className="grid grid-cols-[1fr_1fr_72px] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" value={value.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" value={value.city} onChange={(e) => set({ city: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uf">UF</Label>
          <Input id="uf" value={value.uf} onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })} disabled={disabled} maxLength={2} />
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <Label htmlFor="visibility">Quem pode ver seu endereço</Label>
        <Select
          id="visibility"
          value={value.visibility}
          onValueChange={(v) => set({ visibility: v as AddressVisibility })}
          disabled={disabled}
        >
          {VISIBILITY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {VISIBILITY_OPTIONS.find((o) => o.id === value.visibility)?.hint}
        </p>
      </div>
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

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const effective = slugify(slug);
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
        <LinkSimple className="h-5 w-5 text-primary" /> Link de agendamento
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
          {saving ? <CircleNotch className="h-4 w-4 animate-spin" /> : null}
          Salvar link
        </Button>
      )}
    </Card>
  );
}

/* ───────────────────────────── Logo ──────────────────────────── */

const MAX_LOGO_BYTES = 15 * 1024 * 1024; // 15 MB (arquivo original; comprimimos antes de enviar)

/**
 * Redimensiona (lado máx. 512px, sem upscale) e recomprime a imagem no navegador
 * para WebP — reduz fotos de celular de vários MB para dezenas de KB, preservando
 * a transparência da logo. Se algo falhar, devolve o arquivo original.
 */
async function compressImage(file: File, maxDim = 512, quality = 0.9): Promise<File> {
  try {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("decode"));
      i.src = dataUrl;
    });

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/webp", quality),
    );
    if (!blob) return file; // navegador sem WebP no canvas → usa o original
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

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
      setError("Imagem muito grande. Máximo 15 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await uploadLogo(salon.slug, fd);
      setBusy(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setLogoUrl(res.url);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Não foi possível processar a imagem. Tente outra.");
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await removeLogo(salon.slug);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
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
        Aparece no seu link de agendamento. Otimizamos a imagem automaticamente.
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
                <CircleNotch className="h-4 w-4 animate-spin" />
              ) : (
                <UploadSimple className="h-4 w-4" />
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
                <Trash className="h-3.5 w-3.5" /> Remover
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

/* ───────────────────────── Caixa ───────────────────────── */

function CashSettingsPanel({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(salon.cash_discount_enabled);
  const [maxPct, setMaxPct] = useState(String(salon.cash_max_discount_percent ?? 0));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setSaved(false); setError(null);
    const pct = Math.min(100, Math.max(0, parseFloat(maxPct.replace(",", ".")) || 0));
    const supabase = createClient();
    const { error: e } = await supabase
      .from("salons")
      .update({ cash_discount_enabled: enabled, cash_max_discount_percent: pct })
      .eq("id", salon.id);
    setSaving(false);
    if (e) { setError("Não foi possível salvar. Tente novamente."); return; }
    setMaxPct(String(pct));
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Descontos no caixa
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Permite dar desconto ao receber um atendimento. A comissão do profissional
          continua sobre o preço cheio — o desconto sai do resultado do salão.
        </p>

        <div className="flex items-start gap-3 mt-4">
          <button
            type="button"
            onClick={() => canEdit && setEnabled((v) => !v)}
            disabled={!canEdit}
            aria-pressed={enabled}
            className={`relative h-6 w-11 rounded-full transition shrink-0 mt-0.5 disabled:opacity-60 ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
          <div>
            <p className="text-sm font-medium">Habilitar descontos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quem pode dar desconto é definido por profissional na aba <b>Acessos</b> (permissão
              &ldquo;Dar desconto no caixa&rdquo;). A proprietária sempre pode.
            </p>
          </div>
        </div>

        {enabled && (
          <div className="space-y-1.5 mt-4 max-w-[200px]">
            <Label htmlFor="maxpct">Desconto máximo (%)</Label>
            <Input
              id="maxpct"
              value={maxPct}
              onChange={(e) => setMaxPct(e.target.value)}
              inputMode="decimal"
              disabled={!canEdit}
              placeholder="Ex: 10"
            />
            <p className="text-xs text-muted-foreground">Teto do desconto que pode ser aplicado.</p>
          </div>
        )}
      </Card>

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
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
          <LinkSimple className="h-5 w-5 text-primary" /> Link de agendamento
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
  const niche = salon.niche as Niche;
  const defaultColor = NICHE_DEFAULT_COLOR[niche]; // null = identidade nativa (barbearia)
  // "" = sentinela "usar padrão do nicho" (sem data-color no HTML para barbearia)
  const toState = (v: string | null | undefined): ColorTheme | "" =>
    !v || v === "" ? "" : (v as ColorTheme);

  const [colorTheme, setColorTheme] = useState<ColorTheme | "">(
    toState(salon.color_theme),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "padrão" = string vazia (ou, para nichos não-barbearia, a cor mapeada)
  const isDefault = defaultColor === null ? colorTheme === "" : colorTheme === defaultColor;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("salons")
      .update({ color_theme: colorTheme || "" })
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

  // Swatch visual do padrão do nicho (barbearia tem preview próprio; outros usam a paleta default)
  const defaultPreview = defaultColor === null
    ? BARBEARIA_DEFAULT_PREVIEW
    : (() => {
        const v = COLOR_GROUPS.flatMap((g) => g.variants).find((x) => x.id === defaultColor);
        return v ? { background: v.background, primary: v.primary, accent: v.accent } : BARBEARIA_DEFAULT_PREVIEW;
      })();

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="font-display font-semibold">Paleta de cores</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O segmento define a tipografia; a cor é livre — escolha entre os 3 grupos ou volte ao Padrão.
          </p>
        </div>

        {/* Swatch "Padrão" destacado no topo */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider">Padrão do segmento</p>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setColorTheme(defaultColor ?? "")}
            aria-pressed={isDefault}
            className={`w-full sm:w-48 overflow-hidden rounded-xl border text-left transition disabled:opacity-60 ${
              isDefault
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-foreground/25"
            }`}
          >
            <div
              className="flex h-14 items-center justify-center gap-2"
              style={{ background: defaultPreview.background }}
            >
              <span
                className="h-7 w-7 rounded-full ring-1 ring-black/10"
                style={{ background: defaultPreview.primary }}
              />
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                style={{ background: defaultPreview.accent }}
              />
            </div>
            <div className="flex items-center justify-between gap-1 bg-card px-2.5 py-2">
              <span className="text-xs font-medium">Padrão</span>
              {isDefault && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </div>
          </button>
        </div>

        <div className="border-t border-border pt-5 grid gap-x-8 gap-y-6 lg:grid-cols-3">
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
