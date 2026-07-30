"use client";

import { useMemo, useRef, useState } from "react";
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
import { BiometricCard } from "@/components/auth/BiometricCard";
import { SubscribePanel } from "../assinatura/SubscribePanel";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { HomeServiceCard, type HomeServiceState } from "./HomeServiceCard";
import type { AccessStatus } from "@/lib/subscription";
import {
  ArrowClockwise,
  ArrowLeft,
  CaretRight,
  Check,
  CircleNotch,
  Clock,
  Copy,
  CreditCard,
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  WhatsappLogo,
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
import { SITE_URL } from "@/lib/siteUrl";
import { instagramUrl, facebookUrl, googleUrl } from "@/lib/social";

// URL canônica (produção) — o prefixo do link mostrado pra dona. NEXT_PUBLIC_ é
// embutida no build, igual no servidor/cliente, sem o render duplo do antigo
// useEffect(setOrigin). Ela vê a URL que de fato vai compartilhar (não localhost).

type Pro = { id: string; name: string };
type OwnerInfo = { id: string; display_name: string | null; full_name: string | null };
type TabId = "estabelecimento" | "horarios" | "agendamento" | "caixa" | "aparencia" | "acessos" | "whatsapp" | "assinatura";
type Role = "manager" | "professional" | "receptionist";
type Perm = { key: string; label: string; category: string };
type RolePerm = { role: string; permission_key: string; allowed: boolean };

// A descrição não é enfeite: com oito seções, o rótulo sozinho não diz onde
// mexer no horário de almoço ou onde trocar a cor. Ela é o que evita entrar em
// três seções até achar a certa.
const TAB_META: {
  id: TabId;
  label: string;
  hint: string;
  icon: typeof Storefront;
  need: "salon" | "schedule" | "team" | "whatsapp" | "billing";
}[] = [
  { id: "estabelecimento", label: "Estabelecimento", hint: "Nome, endereço, contato e logo", icon: Storefront, need: "salon" },
  { id: "horarios", label: "Horários", hint: "Dias e horários de atendimento", icon: Clock, need: "schedule" },
  { id: "agendamento", label: "Agendamento", hint: "Link público e regras de reserva", icon: LinkSimple, need: "salon" },
  { id: "caixa", label: "Caixa", hint: "Formas de pagamento e comissões", icon: Wallet, need: "salon" },
  { id: "acessos", label: "Acessos", hint: "O que cada cargo pode ver e fazer", icon: ShieldCheck, need: "team" },
  { id: "aparencia", label: "Aparência", hint: "Cores e tema da sua página", icon: Palette, need: "salon" },
  { id: "whatsapp", label: "WhatsApp", hint: "Conexão e mensagens automáticas", icon: WhatsappLogo, need: "whatsapp" },
  { id: "assinatura", label: "Assinatura", hint: "Plano, cobrança e faturas", icon: CreditCard, need: "billing" },
];

export function SettingsTabs({
  salon,
  owner,
  canEditSalon,
  canManageSalon,
  canManageSchedule,
  canManageTeam,
  canManageWhatsApp,
  canManageBilling,
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
  canManageWhatsApp: boolean;
  canManageBilling: boolean;
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
      TAB_META.filter((t) => {
        switch (t.need) {
          case "schedule": return canManageSchedule;
          case "team":     return canManageTeam;
          case "whatsapp": return canManageWhatsApp;
          case "billing":  return canManageBilling;
          default:         return canManageSalon;
        }
      }),
    [canManageSalon, canManageSchedule, canManageTeam, canManageWhatsApp, canManageBilling],
  );

  const validInitial = tabs.find((t) => t.id === initialTab)?.id;

  // `null` = nenhuma seção escolhida. No celular isso é a lista (padrão de
  // app de configurações: toca, entra, volta); no desktop não existe estado
  // vazio, então cai na primeira seção.
  const [active, setActive] = useState<TabId | null>(validInitial ?? null);
  const noDesktop = active ?? tabs[0]?.id ?? "estabelecimento";
  const meta = TAB_META.find((t) => t.id === noDesktop);

  function selectTab(id: TabId) {
    setActive(id);
    router.replace(`${pathname}?tab=${id}`, { scroll: false });
  }

  function voltar() {
    setActive(null);
    router.replace(pathname, { scroll: false });
  }

  function painel(id: TabId) {
    switch (id) {
      case "estabelecimento":
        return (
          <div className="space-y-5">
            <EstablishmentPanel salon={salon} owner={owner} canEdit={canEditSalon} />
            <PushNotificationsCard salonId={salon.id} />
            <BiometricCard />
          </div>
        );
      case "horarios":
        return <HoursManager salonId={salon.id} pros={pros} initialHours={initialHours} embedded />;
      case "agendamento":
        return <BookingPanel salon={salon} canEdit={canEditSalon} />;
      case "caixa":
        return <CashSettingsPanel salon={salon} canEdit={canEditSalon} />;
      case "aparencia":
        return <AppearancePanel salon={salon} canEdit={canEditSalon} />;
      case "acessos":
        return (
          <AccessPanel
            salonId={salon.id}
            permissions={permissions}
            roleDefaults={roleDefaults}
            salonRolePerms={salonRolePerms}
          />
        );
      case "whatsapp":
        return <WhatsAppPanel slug={salon.slug} />;
      case "assinatura":
        return access ? (
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
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho — no celular, dentro de uma seção ele vira o título dela,
          com o voltar. Repetir "Configurações" ali gastaria a linha mais
          valiosa da tela sem dizer onde a pessoa está. */}
      <div className={cn(active ? "hidden lg:block" : "block")}>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Dados do salão, horários, agendamento e aparência.
        </p>
      </div>

      {active && (
        <div className="lg:hidden">
          <button
            onClick={voltar}
            className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Configurações
          </button>
          <h1 className="font-display text-2xl font-bold">{meta?.label}</h1>
          {meta?.hint && <p className="text-sm text-muted-foreground">{meta.hint}</p>}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* ── Menu lateral (desktop) ────────────────────────────────────
            Vertical em vez de barra horizontal: as oito seções cabem todas
            na tela, com rótulo, sem rolagem lateral e sem adivinhar ícone. */}
        <nav className="hidden lg:block lg:sticky lg:top-20">
          <ul className="space-y-0.5">
            {tabs.map((t) => {
              const on = noDesktop === t.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => selectTab(t.id)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition",
                      on
                        ? "bg-secondary text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <t.icon
                      className="h-[18px] w-[18px] shrink-0"
                      weight={on ? "fill" : "regular"}
                    />
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Lista de seções (mobile) ──────────────────────────────── */}
        <ul
          className={cn(
            "divide-y divide-border overflow-hidden rounded-[var(--radius)] border border-border bg-card lg:hidden",
            active && "hidden",
          )}
        >
          {tabs.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => selectTab(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <t.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                </span>
                <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        {/* ── Conteúdo ──────────────────────────────────────────────── */}
        <div className={cn("min-w-0", !active && "hidden lg:block")}>{painel(noDesktop)}</div>
      </div>
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

  // Padrão global do cargo, sem os ajustes do salão. É o que permite mostrar
  // "voltou ao padrão" e oferecer o botão de restaurar.
  const padraoPorCargo = useMemo(() => {
    const out: Record<string, Record<string, boolean>> = {
      manager: {},
      professional: {},
      receptionist: {},
    };
    for (const rd of roleDefaults) {
      if (out[rd.role]) out[rd.role][rd.permission_key] = rd.allowed;
    }
    return out;
  }, [roleDefaults]);

  // Estado efetivo: padrão do cargo ⊕ ajuste que este salão já salvou.
  const inicial = useMemo(() => {
    const monta = (r: Role) => {
      const map: Record<string, boolean> = { ...padraoPorCargo[r] };
      for (const sr of salonRolePerms) if (sr.role === r) map[sr.permission_key] = sr.allowed;
      return map;
    };
    return {
      manager: monta("manager"),
      professional: monta("professional"),
      receptionist: monta("receptionist"),
    } as Record<Role, Record<string, boolean>>;
  }, [padraoPorCargo, salonRolePerms]);

  const [state, setState] = useState(inicial);

  function toggle(key: string) {
    setState((s) => ({ ...s, [role]: { ...s[role], [key]: !s[role][key] } }));
    setSaved(false);
  }

  function restaurarPadrao() {
    setState((s) => ({ ...s, [role]: { ...padraoPorCargo[role] } }));
    setSaved(false);
  }

  // Quantas mudanças não salvas existem em CADA cargo. É o que impede a perda
  // silenciosa que existia antes: quem editava Gerente, trocava pra Recepção e
  // salvava perdia o primeiro sem nenhum aviso.
  const pendentes = useMemo(() => {
    const conta = (r: Role) =>
      permissions.filter((p) => !!state[r][p.key] !== !!inicial[r][p.key]).length;
    return {
      manager: conta("manager"),
      professional: conta("professional"),
      receptionist: conta("receptionist"),
    } as Record<Role, number>;
  }, [state, inicial, permissions]);

  const totalPendente = pendentes.manager + pendentes.professional + pendentes.receptionist;
  const liberadas = permissions.filter((p) => !!state[role][p.key]).length;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();

    // Grava TODOS os cargos com pendência, não só o que está na tela.
    const rows = (Object.keys(pendentes) as Role[])
      .filter((r) => pendentes[r] > 0)
      .flatMap((r) =>
        permissions.map((p) => ({
          salon_id: salonId,
          role: r,
          permission_key: p.key,
          allowed: !!state[r][p.key],
        })),
      );

    if (rows.length === 0) {
      setSaving(false);
      return;
    }

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
    <div className="space-y-4 pb-24">
      <Card className="p-6">
        <h2 className="font-display font-semibold">Acessos por cargo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina o que cada cargo pode ver e fazer. Exceções para uma pessoa
          específica ficam na página Equipe — quem é dono sempre tem acesso total.
        </p>

        {/* Seletor de cargo. O número de pendências fica no próprio botão:
            é o que avisa que existe alteração esperando em outro cargo. */}
        <div className="mt-5 flex flex-wrap gap-1 rounded-[var(--radius)] border border-border p-1">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
            const on = role === r;
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] px-3.5 py-2 text-sm font-medium transition",
                  on
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {ROLE_LABELS[r]}
                {pendentes[r] > 0 && (
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums",
                      on ? "bg-white/25 text-primary-foreground" : "bg-amber-500/15 text-amber-600",
                    )}
                    title={`${pendentes[r]} alteração(ões) não salva(s)`}
                  >
                    {pendentes[r]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{liberadas}</b> de{" "}
            <span className="tabular-nums">{permissions.length}</span> liberadas para{" "}
            {ROLE_LABELS[role]}
          </p>
          <button
            onClick={restaurarPadrao}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowClockwise className="h-4 w-4" /> Restaurar padrão do cargo
          </button>
        </div>
      </Card>

      {Object.entries(grouped).map(([cat, perms]) => {
        const ligadas = perms.filter((p) => !!state[role][p.key]).length;
        return (
          <Card key={cat} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {cat}
              </p>
              <span className="text-xs tabular-nums text-muted-foreground">
                {ligadas}/{perms.length}
              </span>
            </div>

            <ul className="divide-y divide-border">
              {perms.map((p) => {
                const on = !!state[role][p.key];
                const padrao = !!padraoPorCargo[role][p.key];
                const alterado = on !== !!inicial[role][p.key];
                return (
                  <li key={p.key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-muted/60",
                        alterado && "bg-amber-500/[0.06]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(p.key)}
                        aria-pressed={on}
                        aria-label={p.label}
                        className={cn(
                          "relative h-6 w-11 shrink-0 rounded-full transition",
                          on ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                            on ? "left-[22px]" : "left-0.5",
                          )}
                        />
                      </button>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{p.label}</span>
                        {/* Só aparece quando difere do padrão: dizer "padrão:
                            liberado" em tudo viraria ruído e ninguém leria. */}
                        {on !== padrao && (
                          <span className="block text-xs text-muted-foreground">
                            Padrão do cargo: {padrao ? "liberado" : "bloqueado"}
                          </span>
                        )}
                      </span>

                      {alterado && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                          alterado
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {/* Barra fixa: só existe quando há o que salvar, e diz exatamente o que
          será gravado — inclusive de cargos que não estão na tela. */}
      {(totalPendente > 0 || saving || saved || error) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-md lg:left-[var(--sidebar-w,0px)]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-2">
            <p className="text-sm">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : saved ? (
                <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> Permissões salvas
                </span>
              ) : (
                <>
                  <b className="tabular-nums">{totalPendente}</b> alteraç
                  {totalPendente === 1 ? "ão" : "ões"} em{" "}
                  {(Object.keys(pendentes) as Role[])
                    .filter((r) => pendentes[r] > 0)
                    .map((r) => ROLE_LABELS[r])
                    .join(", ")}
                </>
              )}
            </p>
            <Button onClick={save} disabled={saving || totalPendente === 0}>
              {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar alterações
            </Button>
          </div>
        </div>
      )}
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
  const [instagram, setInstagram] = useState(s.instagram ?? "");
  const [facebook, setFacebook] = useState(s.facebook ?? "");
  const [google, setGoogle] = useState(s.google_business ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    // Campo preenchido que não vira link é pior que campo vazio: a página
    // pública ganharia um botão quebrado, e quem publicou não ficaria sabendo.
    const invalidas = [
      instagram.trim() && !instagramUrl(instagram) ? "Instagram" : null,
      facebook.trim() && !facebookUrl(facebook) ? "Facebook" : null,
      google.trim() && !googleUrl(google) ? "Google" : null,
    ].filter(Boolean);
    if (invalidas.length > 0) {
      setError(
        `Não consegui montar o link de ${invalidas.join(" e ")}. ` +
        "Instagram e Facebook aceitam o @ ou o link; o Google precisa do link que ele mesmo gera em Compartilhar.",
      );
      return;
    }

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
        // Guarda o texto cru: quem digitou "@salao" volta e vê "@salao", não
        // uma URL que ele não escreveu. A montagem do link é na leitura.
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        google_business: google.trim() || null,
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

      {/* Redes sociais — card próprio, e não mais um campo solto em "Dados do
          salão": o que muda aqui aparece pro CLIENTE, não é cadastro interno.
          Campo vazio some da página pública sozinho, sem interruptor. */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="font-display font-semibold">Redes sociais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aparecem no rodapé da sua página de agendamento e na tela de
            confirmação, depois que o cliente marca. O que ficar em branco
            simplesmente não aparece.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <SocialField
            id="instagram"
            label="Instagram"
            icon={<InstagramLogo className="h-4 w-4" />}
            placeholder="@seusalao"
            value={instagram}
            onChange={setInstagram}
            disabled={!canEdit}
            preview={instagramUrl(instagram)}
            hint="Pode colar o @ ou o link do perfil."
          />
          <SocialField
            id="facebook"
            label="Facebook"
            icon={<FacebookLogo className="h-4 w-4" />}
            placeholder="@seusalao"
            value={facebook}
            onChange={setFacebook}
            disabled={!canEdit}
            preview={facebookUrl(facebook)}
            hint="Pode colar o @ ou o link da página."
          />
          <SocialField
            id="google"
            label="Google Meu Negócio"
            icon={<GoogleLogo className="h-4 w-4" />}
            placeholder="https://g.page/..."
            value={google}
            onChange={setGoogle}
            disabled={!canEdit}
            preview={googleUrl(google)}
            hint="No Google Meu Negócio: Compartilhar → copiar link."
          />
        </div>
      </Card>

      <LinkCard salon={salon} canEdit={canEdit} />

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
  );
}

/**
 * Campo de rede social com conferência ao vivo.
 *
 * O link montado aparece embaixo enquanto se digita: é o que deixa claro que
 * "@salao" e "instagram.com/salao" dão no mesmo lugar, e mostra na hora quando
 * o valor não vira link nenhum — em vez de descobrir isso pela página pública
 * quebrada, depois de já ter divulgado.
 */
function SocialField({
  id, label, icon, placeholder, value, onChange, disabled, preview, hint,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  preview: string | null;
  hint: string;
}) {
  const invalido = value.trim().length > 0 && !preview;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {icon} {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalido || undefined}
        className={invalido ? "border-amber-500/60" : undefined}
      />
      {preview ? (
        <p className="truncate text-xs text-emerald-600">{preview}</p>
      ) : invalido ? (
        <p className="text-xs text-amber-600">Não consegui montar o link. {hint}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
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
  instagram: string | null;
  facebook: string | null;
  google_business: string | null;
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
        <span className="text-muted-foreground shrink-0">{SITE_URL}/</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={!canEdit}
          className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60"
        />
      </div>
      {effective !== slug && (
        <p className="mt-1 text-xs text-muted-foreground">
          Ficará: <strong>{SITE_URL}/{effective || "…"}</strong>
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
  const [home, setHome] = useState<HomeServiceState>({
    enabled: salon.home_service_enabled,
    firstKmFee: brlInput(salon.home_first_km_fee),
    extraKmFee: brlInput(salon.home_extra_km_fee),
    maxKm: salon.home_max_km == null ? "" : String(salon.home_max_km),
    terms: salon.home_terms ?? "",
  });
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
      .update({
        allow_simultaneous: simultaneous,
        home_service_enabled: home.enabled,
        home_first_km_fee: numero(home.firstKmFee) ?? 0,
        home_extra_km_fee: numero(home.extraKmFee) ?? 0,
        // null e 0 são coisas diferentes: null é "não declarei limite", e o
        // check do banco recusa 0.
        home_max_km: numero(home.maxKm),
        home_terms: home.terms.trim() || null,
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

      <HomeServiceCard value={home} onChange={setHome} canEdit={canEdit} slug={salon.slug} />

      {canEdit && <SaveBar onSave={save} saving={saving} saved={saved} error={error} />}
    </div>
  );
}

/** "5.00" (numeric do banco) → "5,00" no campo. Vazio quando é zero. */
function brlInput(v: number | null | undefined): string {
  if (v == null || Number(v) === 0) return "";
  return String(v).replace(".", ",");
}

/** Campo de texto → número, aceitando vírgula. Vazio ou lixo vira null. */
function numero(s: string): number | null {
  const n = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : n;
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
