"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { COLOR_GROUPS, type ColorTheme } from "@/lib/themes";
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
} from "lucide-react";

type Pro = { id: string; name: string };
type TabId = "estabelecimento" | "horarios" | "agendamento" | "aparencia";

const TAB_META: { id: TabId; label: string; icon: typeof Store; need: "salon" | "schedule" }[] = [
  { id: "estabelecimento", label: "Estabelecimento", icon: Store, need: "salon" },
  { id: "horarios", label: "Horários", icon: Clock, need: "schedule" },
  { id: "agendamento", label: "Agendamento", icon: Link2, need: "salon" },
  { id: "aparencia", label: "Aparência", icon: Palette, need: "salon" },
];

export function SettingsTabs({
  salon,
  canEditSalon,
  canManageSalon,
  canManageSchedule,
  pros,
  initialHours,
  initialTab,
}: {
  salon: Tables<"salons">;
  canEditSalon: boolean;
  canManageSalon: boolean;
  canManageSchedule: boolean;
  pros: Pro[];
  initialHours: Tables<"working_hours">[];
  initialTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = useMemo(
    () =>
      TAB_META.filter((t) =>
        t.need === "schedule" ? canManageSchedule : canManageSalon,
      ),
    [canManageSalon, canManageSchedule],
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

      {/* Barra de tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition shrink-0 ${
                on
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
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
      .update({ name, phone: phone || null, address: address || null })
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

        {/* Logo — placeholder até configurarmos o Storage */}
        <Card className="p-6">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" /> Logo
          </h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="grid place-items-center h-16 w-16 rounded-[var(--radius)] border border-dashed border-border text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Upload de logo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Em breve — vamos habilitar o envio de imagem para personalizar a sua
                página de agendamento.
              </p>
            </div>
          </div>
        </Card>
      </div>

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
