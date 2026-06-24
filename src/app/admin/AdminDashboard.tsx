"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { MotionModal } from "@/components/MotionModal";
import { AnimatePresence } from "framer-motion";
import { formatBRL, formatDate, formatTime } from "@/lib/utils";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  ArrowSquareOut,
  Buildings,
  ChartBar,
  ChatCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  DownloadSimple,
  Envelope,
  Megaphone,
  Percent,
  Receipt,
  Repeat,
  ShieldCheck,
  Sparkle,
  Trash,
  TrendDown,
  TrendUp,
  UserPlus,
  Users,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getSalonBilling } from "./actions";

type BillingPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string | null;
};

export type AdminMetrics = {
  mrr: number;
  arr: number;
  arpu: number;
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  total: number;
  canceled_30d: number;
  new_30d: number;
  new_this_month: number;
  conversion: number; // %
  churn_30d: number; // %
  series: { month: string; count: number }[];
  mrr_series: { month: string; mrr: number }[];
};

export type AdminSalon = {
  salon_id: string;
  name: string;
  slug: string;
  created_at: string;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  plan: string | null;
  status: string | null;
  value: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  appts_30d: number;
  clients_count: number;
  members_count: number;
  last_activity: string | null;
};

export type AdminUser = {
  profile_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  action: string;
  salon_name: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  message: string;
  kind: "info" | "warning" | "success";
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  created_at: string;
};

/** Dias desde a última atividade (criação de agendamento). null = nunca. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Saúde por inatividade: verde <7d, âmbar <30d, vermelho 30d+ ou nunca. */
function healthMeta(lastActivity: string | null): { cls: string; label: string } {
  const d = daysSince(lastActivity);
  if (d === null) return { cls: "bg-red-500", label: "sem atividade" };
  if (d < 7) return { cls: "bg-emerald-500", label: `ativo · ${d}d` };
  if (d < 30) return { cls: "bg-amber-500", label: `${d}d parado` };
  return { cls: "bg-red-500", label: `${d}d parado` };
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/12 text-emerald-600" },
  trialing: { label: "Trial", cls: "bg-blue-500/12 text-blue-600" },
  past_due: { label: "Inadimplente", cls: "bg-amber-500/15 text-amber-600" },
  canceled: { label: "Cancelado", cls: "bg-red-500/12 text-red-600" },
};

const statusMeta = (s: string | null) =>
  STATUS_META[s ?? ""] ?? { label: s ?? "—", cls: "bg-muted text-muted-foreground" };

const planName = (p: string | null) => (p && p in PLANS ? PLANS[p as PlanId].name : (p ?? "—"));

const PAYMENT_META: Record<string, { label: string; cls: string }> = {
  RECEIVED: { label: "Pago", cls: "bg-emerald-500/12 text-emerald-600" },
  CONFIRMED: { label: "Pago", cls: "bg-emerald-500/12 text-emerald-600" },
  RECEIVED_IN_CASH: { label: "Pago", cls: "bg-emerald-500/12 text-emerald-600" },
  PENDING: { label: "Pendente", cls: "bg-amber-500/15 text-amber-600" },
  OVERDUE: { label: "Vencida", cls: "bg-red-500/12 text-red-600" },
  REFUNDED: { label: "Estornada", cls: "bg-muted text-muted-foreground" },
};
const paymentMeta = (s: string) =>
  PAYMENT_META[s] ?? { label: s, cls: "bg-muted text-muted-foreground" };

/** Exporta a lista (já filtrada) de salões para CSV (delimitador ";" p/ Excel pt-BR). */
function exportSalonsCsv(rows: AdminSalon[]) {
  const header = [
    "Salão", "Link", "Dono", "E-mail", "Plano", "Status", "Valor (R$/mês)",
    "Criado em", "Agend. 30d", "Clientes", "Profissionais", "Última atividade",
  ];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((s) =>
    [
      s.name, s.slug, s.owner_name ?? "", s.owner_email ?? "",
      planName(s.plan), statusMeta(s.status).label,
      (s.value ?? 0).toFixed(2).replace(".", ","),
      formatDate(s.created_at), s.appts_30d, s.clients_count, s.members_count,
      s.last_activity ? formatDate(s.last_activity) : "",
    ].map(cell).join(";"),
  );
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saloes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminDashboard({
  metrics,
  salons,
  admins,
  audit,
  announcements,
  mrrHistory,
}: {
  metrics: AdminMetrics | null;
  salons: AdminSalon[];
  admins: AdminUser[];
  audit: AuditEntry[];
  announcements: Announcement[];
  mrrHistory: { month: string; mrr: number }[];
}) {
  // Usa o histórico real (snapshots) quando há ao menos 2 pontos; senão, a estimativa.
  const useRealMrr = mrrHistory.length >= 2;
  const mrrChartSeries = useRealMrr ? mrrHistory : (metrics?.mrr_series ?? []);
  const [managing, setManaging] = useState<AdminSalon | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<"atencao" | "geral" | "saloes" | "admin" | "avisos">("atencao");

  // "Precisa de atenção": trials vencendo, inadimplentes e salões parados.
  const TRIAL_SOON_DAYS = 3;
  const INACTIVE_DAYS = 21;
  const now = Date.now();
  const trialsEnding = salons.filter(
    (s) => s.status === "trialing" && s.trial_ends_at &&
      new Date(s.trial_ends_at).getTime() - now <= TRIAL_SOON_DAYS * 86_400_000,
  );
  const overdue = salons.filter((s) => s.status === "past_due");
  const inactive = salons.filter(
    (s) => (s.status === "active" || s.status === "trialing") &&
      (daysSince(s.last_activity) === null || (daysSince(s.last_activity) ?? 0) >= INACTIVE_DAYS),
  );
  const attentionCount = trialsEnding.length + overdue.length + inactive.length;
  const router = useRouter();

  const filtered = salons.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.owner_name ?? "").toLowerCase().includes(q) ||
      (s.owner_email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-dvh px-5 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">Painel da Plataforma</h1>
            <p className="text-sm text-muted-foreground">Visão geral do SaaS e gestão de assinaturas.</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-border">
          {([["atencao", attentionCount > 0 ? `Atenção (${attentionCount})` : "Atenção"], ["geral", "Visão geral"], ["saloes", "Salões"], ["admin", "Administração"], ["avisos", "Avisos"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "atencao" && (
          <AttentionPanel
            trialsEnding={trialsEnding}
            overdue={overdue}
            inactive={inactive}
            onManage={setManaging}
          />
        )}

        {tab === "geral" && (
        <div className="space-y-7">
        {/* Receita */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={TrendUp} label="MRR (ativos)" value={formatBRL(metrics?.mrr ?? 0)} highlight />
          <Kpi icon={Repeat} label="ARR (anual)" value={formatBRL(metrics?.arr ?? 0)} />
          <Kpi icon={Users} label="ARPU" value={formatBRL(metrics?.arpu ?? 0)} />
          <Kpi icon={Percent} label="Conversão trial" value={`${metrics?.conversion ?? 0}%`} hint="estimativa" />
          <Kpi icon={TrendDown} label="Churn (30d)" value={`${metrics?.churn_30d ?? 0}%`} hint="estimativa" />
          <Kpi icon={Sparkle} label="Novos no mês" value={String(metrics?.new_this_month ?? 0)} />
        </div>

        {/* Contagens por status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi icon={Buildings} label="Total de salões" value={String(metrics?.total ?? 0)} />
          <Kpi icon={Users} label="Ativos" value={String(metrics?.active ?? 0)} />
          <Kpi icon={Clock} label="Em trial" value={String(metrics?.trialing ?? 0)} />
          <Kpi icon={Warning} label="Inadimplentes" value={String(metrics?.past_due ?? 0)} />
          <Kpi icon={XCircle} label="Cancelados" value={String(metrics?.canceled ?? 0)} />
        </div>

        {/* Evolução */}
        <div className="grid lg:grid-cols-2 gap-6">
          <MrrChart series={mrrChartSeries} estimated={!useRealMrr} />
          <GrowthChart series={metrics?.series ?? []} />
        </div>
        </div>
        )}

        {tab === "saloes" && (
        <div className="space-y-5">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por salão, link, dono ou e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter} className="sm:w-52">
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="trialing">Em trial</option>
            <option value="past_due">Inadimplentes</option>
            <option value="canceled">Cancelados</option>
          </Select>
        </div>

        {/* Lista de salões */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{filtered.length} salão(ões)</p>
            <Button variant="outline" size="sm" onClick={() => exportSalonsCsv(filtered)} disabled={filtered.length === 0}>
              <DownloadSimple className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-[var(--radius)]">
              Nenhum salão encontrado.
            </p>
          ) : (
            filtered.map((s) => {
              const meta = statusMeta(s.status);
              const health = healthMeta(s.last_activity);
              return (
                <div key={s.salon_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${health.cls}`} title={health.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{s.name}</p>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      /{s.slug} · {s.owner_name || s.owner_email || "sem dono"} · {s.appts_30d} agend. (30d) · {health.label}
                    </p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-sm font-semibold">{planName(s.plan)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "trialing" && s.trial_ends_at
                        ? `trial até ${formatDate(s.trial_ends_at)}`
                        : s.current_period_end
                        ? `vence ${formatDate(s.current_period_end)}`
                        : "—"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setManaging(s)} className="shrink-0">
                    Gerenciar
                  </Button>
                </div>
              );
            })
          )}
        </div>
        </div>
        )}

        {tab === "admin" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <AdminsPanel admins={admins} />
          <AuditPanel audit={audit} />
        </div>
        )}

        {tab === "avisos" && <AnnouncementsPanel announcements={announcements} />}
      </div>

      <AnimatePresence>
        {managing && (
          <ManageModal
            key="manage"
            salon={managing}
            onClose={() => setManaging(null)}
            onDone={() => { setManaging(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, highlight, hint,
}: { icon: React.ElementType; label: string; value: string; highlight?: boolean; hint?: string }) {
  return (
    <div className={`rounded-[var(--radius)] border bg-card p-4 ${highlight ? "border-primary/40" : "border-border"}`}>
      <Icon className={`h-4 w-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <p className="font-display text-lg font-bold mt-2 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[10px] opacity-70">({hint})</span>}
      </p>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  extend_trial: "Estendeu trial",
  set_plan: "Mudou plano",
  set_status: "Mudou status",
  add_admin: "Adicionou admin",
  remove_admin: "Removeu admin",
};

function AdminsPanel({ admins }: { admins: AdminUser[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!email.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_add_admin" as never, { p_email: email.trim() } as never);
    setBusy(false);
    if (error) { setErr(error.message || "Não foi possível adicionar."); return; }
    setEmail("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_remove_admin" as never, { p_profile: id } as never);
    setBusy(false);
    if (error) { setErr(error.message || "Não foi possível remover."); return; }
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-primary" /> Administradores
      </h2>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex gap-2 mb-3">
        <Input
          placeholder="e-mail do novo admin"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          className="flex-1"
        />
        <Button onClick={add} disabled={busy || !email.trim()}>
          {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Adicionar
        </Button>
      </div>
      <div className="space-y-1.5">
        {admins.map((a) => (
          <div key={a.profile_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{a.full_name || a.email || a.profile_id}</p>
              {a.full_name && a.email && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
            </div>
            <button
              onClick={() => remove(a.profile_id)}
              disabled={busy}
              title="Remover admin"
              className="grid place-items-center h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-red-50 hover:text-red-600"
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        O e-mail precisa já ter conta no app. Você não pode remover a si mesmo.
      </p>
    </div>
  );
}

function AuditPanel({ audit }: { audit: AuditEntry[] }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <ClockCounterClockwise className="h-4 w-4 text-primary" /> Atividade recente
      </h2>
      {audit.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-auto">
          {audit.map((e) => {
            const label = ACTION_LABEL[e.action] ?? e.action;
            const extra = e.detail ? Object.values(e.detail).filter(Boolean).join(" · ") : "";
            return (
              <div key={e.id} className="text-sm border-b border-border/60 pb-1.5 last:border-0">
                <p className="truncate">
                  <span className="font-medium">{label}</span>
                  {e.salon_name && <span className="text-muted-foreground"> — {e.salon_name}</span>}
                  {extra && <span className="text-muted-foreground"> ({extra})</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {e.actor_email ?? "—"} · {formatDate(e.created_at)} {formatTime(e.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttentionGroup({
  icon: Icon, title, tone, salons, reason, onManage,
}: {
  icon: React.ElementType;
  title: string;
  tone: string;
  salons: AdminSalon[];
  reason: (s: AdminSalon) => string;
  onManage: (s: AdminSalon) => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${tone}`} /> {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{salons.length}</span>
      </h2>
      {salons.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">Nada por aqui. 👍</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto">
          {salons.map((s) => (
            <div key={s.salon_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{reason(s)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onManage(s)} className="shrink-0">Gerenciar</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttentionPanel({
  trialsEnding, overdue, inactive, onManage,
}: {
  trialsEnding: AdminSalon[];
  overdue: AdminSalon[];
  inactive: AdminSalon[];
  onManage: (s: AdminSalon) => void;
}) {
  const total = trialsEnding.length + overdue.length + inactive.length;
  return (
    <div className="space-y-4">
      {total === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto text-emerald-500" />
          <p className="text-sm text-muted-foreground mt-3">Tudo em dia — nada precisa de atenção agora. 🎉</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <AttentionGroup
            icon={Clock} title="Trials vencendo" tone="text-amber-600"
            salons={trialsEnding} onManage={onManage}
            reason={(s) => {
              const d = s.trial_ends_at ? daysSince(s.trial_ends_at) : null;
              if (d === null) return "sem data de trial";
              if (d > 0) return `venceu há ${d}d`;
              if (d === 0) return "vence hoje";
              return `vence em ${-d}d`;
            }}
          />
          <AttentionGroup
            icon={Warning} title="Inadimplentes" tone="text-red-600"
            salons={overdue} onManage={onManage}
            reason={(s) => `${planName(s.plan)} · ${formatBRL(s.value ?? 0)}/mês`}
          />
          <AttentionGroup
            icon={TrendDown} title="Parados (risco de churn)" tone="text-red-600"
            salons={inactive} onManage={onManage}
            reason={(s) => {
              const d = daysSince(s.last_activity);
              return d === null ? "sem atividade" : `${d}d sem atividade`;
            }}
          />
        </div>
      )}
    </div>
  );
}

const ANN_KIND: Record<string, { label: string; cls: string }> = {
  info: { label: "Informativo", cls: "bg-blue-500/12 text-blue-600" },
  warning: { label: "Aviso", cls: "bg-amber-500/15 text-amber-600" },
  success: { label: "Novidade", cls: "bg-emerald-500/12 text-emerald-600" },
};

function AnnouncementsPanel({ announcements }: { announcements: Announcement[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!message.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_create_announcement" as never, {
      p_message: message.trim(), p_kind: kind, p_link_url: linkUrl, p_link_label: linkLabel,
    } as never);
    setBusy(false);
    if (error) { setErr(error.message || "Não foi possível publicar."); return; }
    setMessage(""); setLinkUrl(""); setLinkLabel(""); setKind("info");
    router.refresh();
  }

  async function toggle(a: Announcement) {
    const { error } = await supabase.rpc("admin_set_announcement_active" as never, { p_id: a.id, p_active: !a.is_active } as never);
    if (!error) router.refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.rpc("admin_delete_announcement" as never, { p_id: id } as never);
    if (!error) router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Novo aviso */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Megaphone className="h-4 w-4 text-primary" /> Novo aviso
        </h2>
        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: Manutenção programada domingo às 2h." />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <option value="info">Informativo</option>
              <option value="warning">Aviso</option>
              <option value="success">Novidade</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Link (opcional)</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" inputMode="url" />
            </div>
            <div className="space-y-1.5">
              <Label>Texto do link</Label>
              <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Saiba mais" />
            </div>
          </div>
          <Button onClick={create} disabled={busy || !message.trim()}>
            {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Publicar
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Avisos ativos aparecem como banner no painel de todos os salões.
          </p>
        </div>
      </div>

      {/* Avisos existentes */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Avisos publicados</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum aviso ainda.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((a) => {
              const meta = ANN_KIND[a.kind] ?? ANN_KIND.info;
              return (
                <div key={a.id} className="rounded-[var(--radius)] border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
                    {!a.is_active && <span className="text-[11px] text-muted-foreground">inativo</span>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="text-sm">{a.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => toggle(a)} className="text-xs font-medium text-primary hover:underline">
                      {a.is_active ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => remove(a.id)} className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-1">
                      <Trash className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3 text-center">
      <p className="font-display text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const monthLabel = (ym: string) => {
  const [, mm] = ym.split("-");
  return MONTH_ABBR[(parseInt(mm) || 1) - 1];
};

function MrrChart({ series, estimated = true }: { series: { month: string; mrr: number }[]; estimated?: boolean }) {
  const W = 320, H = 120, padX = 6, baseY = H - 16, topY = 12;
  const max = Math.max(1, ...series.map((s) => s.mrr));
  const n = series.length;
  const current = series.length ? series[series.length - 1].mrr : 0;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, n - 1);
  const y = (v: number) => baseY - (v / max) * (baseY - topY);
  const line = series.map((s, i) => `${x(i)},${y(s.mrr)}`).join(" ");
  const area = `${x(0)},${baseY} ${line} ${x(n - 1)},${baseY}`;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendUp className="h-4 w-4 text-primary" /> MRR no tempo
          {estimated && <span className="text-[10px] font-normal text-muted-foreground">(estimativa)</span>}
        </h2>
        <span className="text-sm font-bold tabular-nums">{formatBRL(current)}</span>
      </div>
      {n === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sem dados ainda.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40 text-primary" preserveAspectRatio="none">
          <polygon points={area} fill="currentColor" opacity={0.1} />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {series.map((s, i) => (
            <circle key={s.month} cx={x(i)} cy={y(s.mrr)} r={1.8} fill="currentColor" />
          ))}
          {series.map((s, i) => (
            <text key={s.month} x={x(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 7 }}>
              {monthLabel(s.month)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

function GrowthChart({ series }: { series: { month: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const total = series.reduce((a, s) => a + s.count, 0);

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ChartBar className="h-4 w-4 text-primary" /> Novos salões — últimos 12 meses
        </h2>
        <span className="text-xs text-muted-foreground">{total} no período</span>
      </div>
      {series.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sem dados ainda.</p>
      ) : (
        <div className="flex items-end gap-1.5 h-40">
          {series.map((s) => {
            const [, mm] = s.month.split("-");
            const label = MONTH_ABBR[(parseInt(mm) || 1) - 1];
            const h = Math.round((s.count / max) * 100);
            return (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] font-medium tabular-nums text-foreground">{s.count}</span>
                <div className="w-full flex items-end" style={{ height: "100%" }}>
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all"
                    style={{ height: `${Math.max(h, s.count > 0 ? 6 : 2)}%` }}
                    title={`${s.count} em ${s.month}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ManageModal({
  salon, onClose, onDone,
}: { salon: AdminSalon; onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const [plan, setPlan] = useState<string>(salon.plan ?? "basic");
  const meta = statusMeta(salon.status);

  // Cobrança (Asaas) — carregada sob demanda
  const [billing, setBilling] = useState<BillingPayment[] | null>(null);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [contact, setContact] = useState<{ name: string; phone: string | null; email: string | null } | null>(null);

  async function loadBilling() {
    setLoadingBilling(true);
    setBillingMsg(null);
    const res = await getSalonBilling(salon.salon_id);
    setLoadingBilling(false);
    if (res.ok) { setBilling(res.payments); setContact(res.contact); }
    else { setBilling([]); setBillingMsg(res.error); }
  }

  // Cobrança em aberto mais relevante (vencida > pendente) para cobrança proativa
  const duePayment = billing?.find((p) => p.status === "OVERDUE") ?? billing?.find((p) => p.status === "PENDING") ?? null;

  function dunningText() {
    const link = duePayment?.invoiceUrl ? `\n\nPara regularizar: ${duePayment.invoiceUrl}` : "";
    const val = duePayment ? ` de ${formatBRL(duePayment.value)}` : "";
    const venc = duePayment ? ` (venc. ${duePayment.dueDate})` : "";
    return `Olá! 😊 Passando pra lembrar da sua assinatura do Zulan — há uma cobrança em aberto${val}${venc}.${link}`;
  }

  const waHref = (() => {
    if (!contact?.phone) return null;
    const digits = contact.phone.replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(dunningText())}`;
  })();

  const mailHref = contact?.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent("Sua assinatura do Zulan")}&body=${encodeURIComponent(dunningText())}`
    : null;

  async function run(key: string, fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(key);
    setErr(null);
    const { error } = await fn();
    setBusy(null);
    if (error) { setErr("Não foi possível concluir a ação. Tente novamente."); return; }
    onDone();
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] overflow-auto p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold truncate">{salon.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              /{salon.slug} · {salon.owner_email || "—"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {err && (
            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
              <X className="h-4 w-4 shrink-0" /> {err}
            </div>
          )}

          {/* Situação atual */}
          <div className="rounded-[var(--radius)] bg-secondary border border-border p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{planName(salon.plan)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Trial até</span><span>{salon.trial_ends_at ? formatDate(salon.trial_ends_at) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Próx. cobrança</span><span>{salon.current_period_end ? formatDate(salon.current_period_end) : "—"}</span></div>
          </div>

          {/* Uso / saúde */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Uso</p>
            <div className="grid grid-cols-3 gap-2">
              <UsageStat label="Agend. (30d)" value={String(salon.appts_30d)} />
              <UsageStat label="Clientes" value={String(salon.clients_count)} />
              <UsageStat label="Profissionais" value={String(salon.members_count)} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${healthMeta(salon.last_activity).cls}`} />
              <span className="text-muted-foreground">
                Última atividade: {salon.last_activity ? `${formatDate(salon.last_activity)} (${healthMeta(salon.last_activity).label})` : "nenhuma"}
              </span>
            </div>
          </div>

          {/* Estender trial */}
          <div className="space-y-2">
            <Label>Estender trial</Label>
            <div className="flex gap-2">
              <Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="w-24" />
              <Button
                variant="outline"
                onClick={() => run("trial", () => supabase.rpc("admin_extend_trial" as never, { p_salon: salon.salon_id, p_days: parseInt(days) || 0 } as never))}
                disabled={busy !== null}
                className="flex-1"
              >
                {busy === "trial" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Estender {parseInt(days) || 0} dia(s)
              </Button>
            </div>
          </div>

          {/* Mudar plano */}
          <div className="space-y-2">
            <Label>Plano</Label>
            <div className="flex gap-2">
              <Select value={plan} onValueChange={setPlan} className="flex-1">
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <Button
                variant="outline"
                onClick={() => run("plan", () => supabase.rpc("admin_set_plan" as never, { p_salon: salon.salon_id, p_plan: plan } as never))}
                disabled={busy !== null || plan === salon.plan}
              >
                {busy === "plan" ? <CircleNotch className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Acesso */}
          <div className="space-y-2">
            <Label>Acesso</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => run("active", () => supabase.rpc("admin_set_status" as never, { p_salon: salon.salon_id, p_status: "active" } as never))}
                disabled={busy !== null || salon.status === "active"}
              >
                {busy === "active" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <TrendUp className="h-4 w-4" />} Ativar (cortesia)
              </Button>
              <Button
                variant="outline"
                onClick={() => run("block", () => supabase.rpc("admin_set_status" as never, { p_salon: salon.salon_id, p_status: "canceled" } as never))}
                disabled={busy !== null || salon.status === "canceled"}
                className="text-red-600 hover:bg-red-50"
              >
                {busy === "block" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Bloquear
              </Button>
            </div>
          </div>

          {/* Cobrança (Asaas) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cobrança</Label>
              {billing === null && (
                <button onClick={loadBilling} disabled={loadingBilling} className="text-xs font-medium text-primary hover:underline disabled:opacity-60">
                  {loadingBilling ? "Carregando…" : "Ver cobranças"}
                </button>
              )}
            </div>
            {billingMsg && <p className="text-xs text-muted-foreground">{billingMsg}</p>}
            {billing && billing.length > 0 && (
              <div className="rounded-[var(--radius)] border border-border divide-y divide-border">
                {billing.map((p) => {
                  const pm = paymentMeta(p.status);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2.5">
                      <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatBRL(p.value)}</p>
                        <p className="text-xs text-muted-foreground">venc. {p.dueDate}{p.paymentDate ? ` · pago ${p.paymentDate}` : ""}</p>
                      </div>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${pm.cls}`}>{pm.label}</span>
                      {p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" title="2ª via" className="text-primary hover:underline shrink-0">
                          <ArrowSquareOut className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cobrança proativa */}
            {duePayment && (
              <div className="space-y-2 rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  Cobrança em aberto{duePayment.status === "OVERDUE" ? " (vencida)" : ""} — {formatBRL(duePayment.value)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {waHref ? (
                    <a href={waHref} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 rounded-[var(--radius)] bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">
                      <ChatCircle className="h-4 w-4" /> Cobrar no WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem telefone do dono</span>
                  )}
                  {mailHref && (
                    <a href={mailHref}
                      className="inline-flex items-center gap-1.5 h-9 rounded-[var(--radius)] border border-border px-3 text-xs font-medium hover:bg-muted">
                      <Envelope className="h-4 w-4" /> E-mail
                    </a>
                  )}
                  {duePayment.invoiceUrl && (
                    <a href={duePayment.invoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 rounded-[var(--radius)] border border-border px-3 text-xs font-medium hover:bg-muted">
                      <ArrowSquareOut className="h-4 w-4" /> 2ª via
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/painel/${salon.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowSquareOut className="h-4 w-4" /> Abrir painel do salão
          </Link>
        </div>
      </Card>
    </MotionModal>
  );
}
