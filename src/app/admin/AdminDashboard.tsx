"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { Calendar as DatePicker } from "@/components/Calendar";
import { MotionModal } from "@/components/MotionModal";
import { AnimatePresence } from "framer-motion";
import { cn, formatBRL, formatDate, formatTime } from "@/lib/utils";
import { PLANS, type PlanId } from "@/lib/plans";
import { parsePastedSeo, stripSeoTail } from "@/lib/blog/sanitize";
import {
  ArrowSquareOut,
  BookOpenText,
  Robot,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChartBar,
  ChartLineUp,
  ChatCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  DoorOpen,
  DownloadSimple,
  Envelope,
  MagnifyingGlass,
  Megaphone,
  Newspaper,
  PencilSimple,
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
import { PlaybookPanel } from "./PlaybookPanel";
import { AgentesPanel } from "./AgentesPanel";
import { ProspeccaoPanel } from "./ProspeccaoPanel";
import { UpdatesAdminPanel } from "./UpdatesAdminPanel";
import { AdminTabs, AdminTabPanel, type AdminTabDef } from "./AdminTabs";

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

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  body: string;
  read_minutes: number;
  published_at: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
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

type TabId =
  | "atencao" | "geral" | "saloes" | "admin"
  | "avisos" | "blog" | "prospeccao" | "playbook" | "agentes" | "atualizacoes";

const TABS: readonly AdminTabDef<TabId>[] = [
  { id: "atencao", label: "Atenção", icon: Warning },
  { id: "geral", label: "Visão geral", icon: ChartLineUp },
  { id: "saloes", label: "Salões", icon: Buildings },
  { id: "admin", label: "Administração", icon: ShieldCheck },
  { id: "avisos", label: "Avisos", icon: Megaphone },
  { id: "blog", label: "Blog", icon: Newspaper },
  { id: "prospeccao", label: "Prospecção", icon: DoorOpen },
  { id: "playbook", label: "Playbook", icon: BookOpenText },
  // Ao lado do Playbook de propósito: os dois leem a mesma fonte de conteúdo.
  // O Playbook é para você ler; este é para alimentar agentes de IA.
  { id: "agentes", label: "Agentes de IA", icon: Robot },
  { id: "atualizacoes", label: "Atualizações", icon: Sparkle },
];

export function AdminDashboard({
  metrics,
  salons,
  admins,
  audit,
  announcements,
  mrrHistory,
  blogPosts,
}: {
  metrics: AdminMetrics | null;
  salons: AdminSalon[];
  admins: AdminUser[];
  audit: AuditEntry[];
  announcements: Announcement[];
  mrrHistory: { month: string; mrr: number }[];
  blogPosts: BlogPostRow[];
}) {
  // Usa o histórico real (snapshots) quando há ao menos 2 pontos; senão, a estimativa.
  const useRealMrr = mrrHistory.length >= 2;
  const mrrChartSeries = useRealMrr ? mrrHistory : (metrics?.mrr_series ?? []);
  const [managing, setManaging] = useState<AdminSalon | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<TabId>("atencao");

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

  const tabs = TABS.map((t) =>
    t.id === "atencao" ? { ...t, badge: attentionCount } : t,
  );

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 shrink-0 rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" weight="fill" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight">Painel da Plataforma</h1>
              <p className="text-sm text-muted-foreground">Visão geral do SaaS e gestão de assinaturas.</p>
            </div>
          </div>
          {/* Os dois números que respondem "como estamos hoje" sem trocar de
              aba. Some no celular, onde roubariam a tela do que importa. */}
          <dl className="hidden sm:flex items-center gap-6">
            <div className="text-right">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">MRR</dt>
              <dd className="font-display text-lg font-bold tabular-nums leading-tight">{formatBRL(metrics?.mrr ?? 0)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Salões ativos</dt>
              <dd className="font-display text-lg font-bold tabular-nums leading-tight">{metrics?.active ?? 0}</dd>
            </div>
          </dl>
        </header>

        <AdminTabs tabs={tabs} value={tab} onChange={setTab} label="Seções do painel" />

        {tab === "atencao" && (
          <AdminTabPanel id="atencao">
            <AttentionPanel
              trialsEnding={trialsEnding}
              overdue={overdue}
              inactive={inactive}
              onManage={setManaging}
            />
          </AdminTabPanel>
        )}

        {tab === "geral" && (
        <AdminTabPanel id="geral">
        <div className="space-y-6 sm:space-y-7">
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
        </AdminTabPanel>
        )}

        {tab === "saloes" && (
        <AdminTabPanel id="saloes">
        <div className="space-y-5">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative sm:flex-1">
            <label htmlFor="busca-salao" className="sr-only">Buscar salão</label>
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busca-salao"
              type="search"
              placeholder="Buscar por salão, link, dono ou e-mail…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <label htmlFor="filtro-status" className="sr-only">Filtrar por status</label>
          <Select id="filtro-status" value={statusFilter} onValueChange={setStatusFilter} className="sm:w-52">
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
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {filtered.length === salons.length
                ? `${salons.length} salão(ões)`
                : `${filtered.length} de ${salons.length} salão(ões)`}
            </p>
            <Button variant="outline" size="sm" onClick={() => exportSalonsCsv(filtered)} disabled={filtered.length === 0}>
              <DownloadSimple aria-hidden className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border py-10 px-5 text-center">
              <p className="text-sm text-muted-foreground">
                {salons.length === 0 ? "Nenhum salão cadastrado ainda." : "Nenhum salão bate com esse filtro."}
              </p>
              {salons.length > 0 && (query || statusFilter) && (
                <Button
                  variant="ghost" size="sm" className="mt-3"
                  onClick={() => { setQuery(""); setStatusFilter(""); }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            filtered.map((s) => {
              const meta = statusMeta(s.status);
              const health = healthMeta(s.last_activity);
              const vencimento =
                s.status === "trialing" && s.trial_ends_at
                  ? `trial até ${formatDate(s.trial_ends_at)}`
                  : s.current_period_end
                  ? `vence ${formatDate(s.current_period_end)}`
                  : null;
              return (
                <div
                  key={s.salon_id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-[var(--radius)] border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  {/* Decorativo: o mesmo estado já vai escrito na linha abaixo. */}
                  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${health.cls}`} />
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{s.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      /{s.slug} · {s.owner_name || s.owner_email || "sem dono"} · {s.appts_30d} agend. (30d) · {health.label}
                    </p>
                    {/* No celular o plano não cabe na coluna da direita — em vez
                        de sumir (era o que fazia), desce para cá. */}
                    <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                      <span className="font-semibold text-foreground">{planName(s.plan)}</span>
                      {vencimento && ` · ${vencimento}`}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold">{planName(s.plan)}</p>
                    <p className="text-xs text-muted-foreground">{vencimento ?? "—"}</p>
                  </div>
                  <Button
                    variant="outline" size="sm" onClick={() => setManaging(s)}
                    className="ml-auto shrink-0"
                    aria-label={`Gerenciar ${s.name}`}
                  >
                    Gerenciar
                  </Button>
                </div>
              );
            })
          )}
        </div>
        </div>
        </AdminTabPanel>
        )}

        {tab === "admin" && (
        <AdminTabPanel id="admin">
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            <AdminsPanel admins={admins} />
            <AuditPanel audit={audit} />
          </div>
        </AdminTabPanel>
        )}

        {tab === "avisos" && (
          <AdminTabPanel id="avisos"><AnnouncementsPanel announcements={announcements} /></AdminTabPanel>
        )}

        {tab === "blog" && <AdminTabPanel id="blog"><BlogPanel posts={blogPosts} /></AdminTabPanel>}

        {tab === "prospeccao" && <AdminTabPanel id="prospeccao"><ProspeccaoPanel /></AdminTabPanel>}

        {tab === "playbook" && <AdminTabPanel id="playbook"><PlaybookPanel /></AdminTabPanel>}

        {tab === "agentes" && (
          <AdminTabPanel id="agentes"><AgentesPanel metrics={metrics} /></AdminTabPanel>
        )}

        {tab === "atualizacoes" && (
          <AdminTabPanel id="atualizacoes"><UpdatesAdminPanel /></AdminTabPanel>
        )}
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
    </main>
  );
}

function Kpi({
  icon: Icon, label, value, highlight, hint,
}: { icon: React.ElementType; label: string; value: string; highlight?: boolean; hint?: string }) {
  return (
    <div
      className={`rounded-[var(--radius)] border bg-card p-3.5 sm:p-4 ${
        highlight ? "border-primary/40 ring-1 ring-primary/15" : "border-border"
      }`}
    >
      <Icon aria-hidden className={`h-4 w-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <p className={`font-display mt-2 text-lg font-bold tabular-nums leading-tight ${highlight ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="text-xs leading-snug text-muted-foreground">
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
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!email.trim()) return;
    setBusy("add"); setErr(null);
    const { error } = await supabase.rpc("admin_add_admin" as never, { p_email: email.trim() } as never);
    setBusy(null);
    if (error) { setErr(error.message || "Não foi possível adicionar."); return; }
    setEmail("");
    router.refresh();
  }

  async function remove(a: AdminUser) {
    const quem = a.full_name || a.email || "esse administrador";
    if (!window.confirm(`Remover ${quem} da administração da plataforma?`)) return;
    setBusy(a.profile_id); setErr(null);
    const { error } = await supabase.rpc("admin_remove_admin" as never, { p_profile: a.profile_id } as never);
    setBusy(null);
    if (error) { setErr(error.message || "Não foi possível remover."); return; }
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck aria-hidden className="h-4 w-4 text-primary" /> Administradores
      </h2>
      {err && <p role="alert" className="mb-2 text-xs text-red-600">{err}</p>}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="novo-admin" className="sr-only">E-mail do novo administrador</label>
        <Input
          id="novo-admin"
          type="email"
          placeholder="e-mail do novo admin"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          className="sm:flex-1"
        />
        <Button onClick={add} disabled={busy !== null || !email.trim()} className="shrink-0">
          {busy === "add"
            ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
            : <UserPlus aria-hidden className="h-4 w-4" />} Adicionar
        </Button>
      </div>
      <div className="space-y-1.5">
        {admins.map((a) => (
          <div key={a.profile_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.full_name || a.email || a.profile_id}</p>
              {a.full_name && a.email && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
            </div>
            <button
              type="button"
              onClick={() => remove(a)}
              disabled={busy !== null}
              aria-label={`Remover ${a.full_name || a.email || "administrador"}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
            >
              {busy === a.profile_id
                ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
                : <Trash aria-hidden className="h-4 w-4" />}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        O e-mail precisa já ter conta no app. Você não pode remover a si mesmo.
      </p>
    </div>
  );
}

function AuditPanel({ audit }: { audit: AuditEntry[] }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ClockCounterClockwise aria-hidden className="h-4 w-4 text-primary" /> Atividade recente
      </h2>
      {audit.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="scroll-thin max-h-80 space-y-1.5 overflow-auto">
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
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden className={`h-4 w-4 shrink-0 ${tone}`} /> {title}
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {salons.length}
        </span>
      </h2>
      {salons.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">Nada por aqui. 👍</p>
      ) : (
        <div className="scroll-thin max-h-72 space-y-2 overflow-auto">
          {salons.map((s) => (
            <div key={s.salon_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-2.5 transition-colors hover:border-primary/40">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{reason(s)}</p>
              </div>
              <Button
                variant="outline" size="sm" onClick={() => onManage(s)}
                className="shrink-0" aria-label={`Gerenciar ${s.name}`}
              >
                Gerenciar
              </Button>
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
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/50 px-6 py-12 text-center sm:py-16">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <ShieldCheck aria-hidden className="h-7 w-7" weight="fill" />
          </span>
          <p className="mt-4 font-display text-base font-bold">Tudo em dia</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Nenhum trial vencendo, nenhuma cobrança em aberto e nenhum salão parado.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
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
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!message.trim()) return;
    setBusy("new"); setErr(null);
    const { error } = await supabase.rpc("admin_create_announcement" as never, {
      p_message: message.trim(), p_kind: kind, p_link_url: linkUrl, p_link_label: linkLabel,
    } as never);
    setBusy(null);
    if (error) { setErr(error.message || "Não foi possível publicar."); return; }
    setMessage(""); setLinkUrl(""); setLinkLabel(""); setKind("info");
    router.refresh();
  }

  // Publicar/despublicar aparece no painel de TODOS os salões — sem retorno
  // visual dava pra clicar duas vezes e nem saber o que ficou valendo.
  async function toggle(a: Announcement) {
    setBusy(a.id); setErr(null);
    const { error } = await supabase.rpc("admin_set_announcement_active" as never, { p_id: a.id, p_active: !a.is_active } as never);
    setBusy(null);
    if (error) { setErr(error.message || "Não foi possível mudar o aviso."); return; }
    router.refresh();
  }

  async function remove(a: Announcement) {
    if (!window.confirm("Excluir este aviso? Ele some do painel de todos os salões.")) return;
    setBusy(a.id); setErr(null);
    const { error } = await supabase.rpc("admin_delete_announcement" as never, { p_id: a.id } as never);
    setBusy(null);
    if (error) { setErr(error.message || "Não foi possível excluir."); return; }
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 sm:gap-6">
      {/* Novo aviso */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Megaphone aria-hidden className="h-4 w-4 text-primary" /> Novo aviso
        </h2>
        {err && <p role="alert" className="mb-2 text-xs text-red-600">{err}</p>}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aviso-msg">Mensagem</Label>
            <Textarea id="aviso-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: Manutenção programada domingo às 2h." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aviso-tipo">Tipo</Label>
            <Select id="aviso-tipo" value={kind} onValueChange={setKind}>
              <option value="info">Informativo</option>
              <option value="warning">Aviso</option>
              <option value="success">Novidade</option>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aviso-link">Link (opcional)</Label>
              <Input id="aviso-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" inputMode="url" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aviso-link-txt">Texto do link</Label>
              <Input id="aviso-link-txt" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Saiba mais" />
            </div>
          </div>
          <Button onClick={create} disabled={busy !== null || !message.trim()} className="w-full sm:w-auto">
            {busy === "new"
              ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
              : <Megaphone aria-hidden className="h-4 w-4" />} Publicar
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Avisos ativos aparecem como banner no painel de todos os salões.
          </p>
        </div>
      </div>

      {/* Avisos existentes */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">Avisos publicados</h2>
        {announcements.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum aviso ainda.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((a) => {
              const meta = ANN_KIND[a.kind] ?? ANN_KIND.info;
              const ocupado = busy === a.id;
              return (
                <div key={a.id} className={`rounded-[var(--radius)] border border-border p-3 transition-opacity ${ocupado ? "opacity-60" : ""}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
                    {!a.is_active && <span className="text-[11px] text-muted-foreground">inativo</span>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="text-sm">{a.message}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button" onClick={() => toggle(a)} disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                    >
                      {ocupado && <CircleNotch aria-hidden className="h-3.5 w-3.5 animate-spin" />}
                      {a.is_active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button" onClick={() => remove(a)} disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded text-xs font-medium text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                    >
                      <Trash aria-hidden className="h-3.5 w-3.5" /> Excluir
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

function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function BlogPanel({ posts }: { posts: BlogPostRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BlogPostRow | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function remove(p: BlogPostRow) {
    if (!window.confirm(`Excluir o artigo "${p.title}"? Essa ação não pode ser desfeita.`)) return;
    setBusy(p.id); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_delete_blog_post" as never, { p_id: p.id } as never);
    setBusy(null);
    if (error) { setErr("Não foi possível excluir o artigo."); return; }
    router.refresh();
  }

  async function togglePublished(p: BlogPostRow) {
    setBusy(p.id); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_blog_post" as never, {
      p_id: p.id, p_slug: p.slug, p_title: p.title, p_excerpt: p.excerpt, p_category: p.category,
      p_body: p.body, p_read_minutes: p.read_minutes, p_published_at: p.published_at,
      p_is_published: !p.is_published,
    } as never);
    setBusy(null);
    if (error) { setErr("Não foi possível mudar a publicação."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Newspaper aria-hidden className="h-4 w-4 text-primary" /> Posts do blog
        </h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PencilSimple aria-hidden className="h-4 w-4" /> Novo artigo
        </Button>
      </div>

      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}

      {posts.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Nenhum artigo ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => {
            const ocupado = busy === p.id;
            return (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-3 rounded-[var(--radius)] border border-border bg-card p-4 transition ${ocupado ? "opacity-60" : "hover:border-primary/40"}`}
            >
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate font-medium">{p.title}</p>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{p.category}</span>
                  {!p.is_published && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700">Rascunho</span>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  /blog/{p.slug} · {formatDate(p.published_at)} · {p.read_minutes} min
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => togglePublished(p)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                >
                  {ocupado && <CircleNotch aria-hidden className="h-3.5 w-3.5 animate-spin" />}
                  {p.is_published ? "Despublicar" : "Publicar"}
                </button>
                <Button variant="outline" size="sm" onClick={() => setEditing(p)} disabled={busy !== null} aria-label={`Editar ${p.title}`}>
                  Editar
                </Button>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={busy !== null}
                  aria-label={`Excluir ${p.title}`}
                  className="grid h-9 w-9 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                >
                  <Trash aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <BlogPostModal
            key="blog-post"
            post={editing === "new" ? null : editing}
            categories={Array.from(new Set(posts.map((p) => p.category)))}
            onClose={() => setEditing(null)}
            onDone={() => { setEditing(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryCombobox({
  id, value, onChange, categories,
}: { id?: string; value: string; onChange: (v: string) => void; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const matches = categories.filter(
    (c) => c.toLowerCase().includes(value.trim().toLowerCase()) && c !== value,
  );

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Gestão"
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Categorias já usadas"
          className="scroll-thin absolute z-[60] mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius)] border border-border bg-card p-1 text-foreground shadow-xl"
        >
          {matches.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => { onChange(c); setOpen(false); }}
              className="flex w-full items-center rounded-[calc(var(--radius)-0.35rem)] px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:bg-muted"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlogPostModal({
  post, categories, onClose, onDone,
}: { post: BlogPostRow | null; categories: string[]; onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const isNew = post === null;
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [category, setCategory] = useState(post?.category ?? "");
  const [publishedAt, setPublishedAt] = useState(post?.published_at ?? new Date().toISOString().slice(0, 10));
  const [readMinutes, setReadMinutes] = useState(String(post?.read_minutes ?? 5));
  const [isPublished, setIsPublished] = useState(post?.is_published ?? true);
  const [body, setBody] = useState(post?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  function fmtDate(s: string) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  /**
   * Colar o bloco de SEO pronto (Título/Slug/Meta/Palavras-chave) no título
   * separa cada parte em vez de jogar tudo no título. Slug e resumo só são
   * preenchidos se ainda estiverem vazios (não sobrescreve o que já foi
   * digitado). Se não for um bloco, deixa o paste normal acontecer.
   */
  function onTitlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const parsed = parsePastedSeo(e.clipboardData.getData("text"));
    if (!parsed) return;
    e.preventDefault();
    setTitle(parsed.title);
    if (parsed.slug && !slugTouched) { setSlug(slugify(parsed.slug)); setSlugTouched(true); }
    else if (!slugTouched) setSlug(slugify(parsed.title));
    if (parsed.excerpt && !excerpt.trim()) setExcerpt(parsed.excerpt);
  }

  async function save() {
    // Rede de segurança: se sobrou cauda de metadado no título, corta antes
    // de gravar (mesmo que o colar inteligente não tenha pego).
    const cleanTitle = stripSeoTail(title);
    if (cleanTitle !== title) setTitle(cleanTitle);

    if (!cleanTitle.trim() || !slug.trim() || !body.trim()) {
      setErr("Preencha título, slug e corpo do artigo.");
      return;
    }
    setBusy(true);
    setErr(null);
    const args = {
      p_slug: slug.trim(), p_title: cleanTitle, p_excerpt: excerpt.trim(), p_category: category.trim() || "Geral",
      p_body: body, p_read_minutes: parseInt(readMinutes) || 1, p_published_at: publishedAt, p_is_published: isPublished,
    };
    const { error } = isNew
      ? await supabase.rpc("admin_create_blog_post" as never, args as never)
      : await supabase.rpc("admin_update_blog_post" as never, { p_id: post!.id, ...args } as never);
    setBusy(false);
    if (error) { setErr(error.message || "Não foi possível salvar."); return; }
    onDone();
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-auto p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <h3 className="font-display text-lg font-bold">{isNew ? "Novo artigo" : "Editar artigo"}</h3>
          <button
            type="button" onClick={onClose} aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {err && (
            <div role="alert" className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
              <X aria-hidden className="h-4 w-4 shrink-0" /> {err}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="post-titulo">Título</Label>
            <Input
              id="post-titulo"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onPaste={onTitlePaste}
              placeholder="Ex.: Como reduzir faltas no salão"
            />
            <p className="text-[11px] text-muted-foreground">
              Pode colar o bloco pronto (Título / Slug / Meta Description) — a gente separa cada parte automaticamente.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="post-slug">Slug (URL)</Label>
              <Input
                id="post-slug"
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                placeholder="como-reduzir-faltas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-categoria">Categoria</Label>
              <CategoryCombobox id="post-categoria" value={category} onChange={setCategory} categories={categories} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-resumo">Resumo (aparece na listagem)</Label>
            <Textarea id="post-resumo" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Uma ou duas frases sobre o artigo." />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 relative">
              <Label>Data de publicação</Label>
              <button
                type="button"
                onClick={() => setCalOpen((v) => !v)}
                aria-expanded={calOpen}
                className={cn(
                  "h-11 w-full flex items-center justify-between gap-2 rounded-[var(--radius)] border bg-card px-3.5 text-sm transition",
                  calOpen ? "border-primary" : "border-border hover:border-foreground/25",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <CalendarBlank className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{fmtDate(publishedAt)}</span>
                </span>
                <CaretDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", calOpen && "rotate-180")} />
              </button>
              {calOpen && (
                <DatePicker
                  value={publishedAt}
                  onChange={(d) => { setPublishedAt(d); setCalOpen(false); }}
                  className="absolute z-[60] mt-1 w-full shadow-xl"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-min">Min. de leitura</Label>
              <Input id="post-min" type="number" min={1} value={readMinutes} onChange={(e) => setReadMinutes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-status">Status</Label>
              <Select id="post-status" value={isPublished ? "1" : "0"} onValueChange={(v) => setIsPublished(v === "1")}>
                <option value="1">Publicado</option>
                <option value="0">Rascunho</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-corpo">Corpo do artigo</Label>
            <Textarea
              id="post-corpo"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-[13px]"
              placeholder={"Primeiro parágrafo do artigo.\n\n## Um subtítulo\nOutro parágrafo, depois do subtítulo.\n\n- Um item de lista\n- Outro item"}
            />
            <p className="text-[11px] text-muted-foreground">
              Use <code>## Texto</code> para criar um subtítulo, uma linha em branco para separar parágrafos e <code>- </code> no início da linha para criar uma lista.
            </p>
          </div>

          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <PencilSimple className="h-4 w-4" />}
            {isNew ? "Publicar artigo" : "Salvar alterações"}
          </Button>
        </div>
      </Card>
    </MotionModal>
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
  // Sem `preserveAspectRatio="none"`: esticar o viewBox deformava a linha e
  // os nomes dos meses. Agora o SVG mantém a proporção e cresce em altura.
  const W = 560, H = 200, padX = 14, baseY = H - 24, topY = 16;
  const max = Math.max(1, ...series.map((s) => s.mrr));
  const n = series.length;
  const current = series.length ? series[series.length - 1].mrr : 0;
  const anterior = series.length > 1 ? series[series.length - 2].mrr : null;
  const delta = anterior !== null && anterior > 0 ? Math.round(((current - anterior) / anterior) * 100) : null;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, n - 1);
  const y = (v: number) => baseY - (v / max) * (baseY - topY);
  const line = series.map((s, i) => `${x(i)},${y(s.mrr)}`).join(" ");
  const area = `${x(0)},${baseY} ${line} ${x(n - 1)},${baseY}`;
  // Rótulo em todo mês espremeria a base num celular; de dois em dois cabe,
  // e o último sempre aparece (é o mês que interessa).
  const mostraMes = (i: number) => n <= 6 || i === n - 1 || (n - 1 - i) % 2 === 0;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendUp aria-hidden className="h-4 w-4 text-primary" /> MRR no tempo
          {estimated && <span className="text-[10px] font-normal text-muted-foreground">(estimativa)</span>}
        </h2>
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold tabular-nums">{formatBRL(current)}</span>
          {delta !== null && delta !== 0 && (
            <span className={`text-[11px] font-semibold tabular-nums ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {delta > 0 ? "+" : ""}{delta}%
            </span>
          )}
        </span>
      </div>
      {n === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto text-primary"
          role="img"
          aria-label={`MRR por mês. Último valor: ${formatBRL(current)}. Máximo do período: ${formatBRL(max)}.`}
        >
          <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} className="stroke-border" strokeWidth={1} />
          <polygon points={area} fill="currentColor" opacity={0.1} />
          <polyline
            points={line} fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          />
          {/* Só o ponto final ganha destaque — é o número do cabeçalho. */}
          <circle cx={x(n - 1)} cy={y(current)} r={4} fill="currentColor" />
          <circle cx={x(n - 1)} cy={y(current)} r={7} fill="currentColor" opacity={0.18} />
          {series.map((s, i) => (
            mostraMes(i) ? (
              <text key={s.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                {monthLabel(s.month)}
              </text>
            ) : null
          ))}
        </svg>
      )}
    </div>
  );
}

function GrowthChart({ series }: { series: { month: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const total = series.reduce((a, s) => a + s.count, 0);

  const resumo = series.map((s) => `${monthLabel(s.month)}: ${s.count}`).join(", ");

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ChartBar aria-hidden className="h-4 w-4 text-primary" /> Novos salões — 12 meses
        </h2>
        <span className="text-xs text-muted-foreground">{total} no período</span>
      </div>
      {series.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="flex h-40 items-end gap-1 sm:gap-1.5" role="img" aria-label={`Novos salões por mês — ${resumo}.`}>
          {series.map((s) => {
            const label = monthLabel(s.month);
            const h = Math.round((s.count / max) * 100);
            return (
              <div key={s.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium tabular-nums text-foreground">{s.count}</span>
                <div className="flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-t transition-[height] duration-300 ${s.count > 0 ? "bg-primary/80" : "bg-border"}`}
                    style={{ height: `${Math.max(h, s.count > 0 ? 6 : 2)}%` }}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">{label}</span>
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
          <button
            type="button" onClick={onClose} aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {err && (
            <div role="alert" className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
              <X aria-hidden className="h-4 w-4 shrink-0" /> {err}
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
            <Label htmlFor="trial-dias">Estender trial</Label>
            <div className="flex gap-2">
              <Input id="trial-dias" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="w-24 shrink-0" />
              <Button
                variant="outline"
                onClick={() => run("trial", () => supabase.rpc("admin_extend_trial" as never, { p_salon: salon.salon_id, p_days: parseInt(days) || 0 } as never))}
                disabled={busy !== null || !(parseInt(days) > 0)}
                className="min-w-0 flex-1"
              >
                {busy === "trial" ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> : <Clock aria-hidden className="h-4 w-4" />}
                <span className="truncate">Estender {parseInt(days) || 0} dia(s)</span>
              </Button>
            </div>
          </div>

          {/* Mudar plano */}
          <div className="space-y-2">
            <Label htmlFor="plano-salao">Plano</Label>
            <div className="flex gap-2">
              <Select id="plano-salao" value={plan} onValueChange={setPlan} className="min-w-0 flex-1">
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <Button
                variant="outline"
                onClick={() => run("plan", () => supabase.rpc("admin_set_plan" as never, { p_salon: salon.salon_id, p_plan: plan } as never))}
                disabled={busy !== null || plan === salon.plan}
                className="shrink-0"
              >
                {busy === "plan" ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Acesso */}
          <div className="space-y-2">
            <Label>Acesso</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => run("active", () => supabase.rpc("admin_set_status" as never, { p_salon: salon.salon_id, p_status: "active" } as never))}
                disabled={busy !== null || salon.status === "active"}
              >
                {busy === "active" ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> : <TrendUp aria-hidden className="h-4 w-4" />} Ativar (cortesia)
              </Button>
              <Button
                variant="outline"
                onClick={() => run("block", () => supabase.rpc("admin_set_status" as never, { p_salon: salon.salon_id, p_status: "canceled" } as never))}
                disabled={busy !== null || salon.status === "canceled"}
                className="text-red-600 hover:bg-red-500/10"
              >
                {busy === "block" ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> : <XCircle aria-hidden className="h-4 w-4" />} Bloquear
              </Button>
            </div>
          </div>

          {/* Cobrança (Asaas) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cobrança</Label>
              {billing === null && (
                <button
                  type="button" onClick={loadBilling} disabled={loadingBilling}
                  className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60"
                >
                  {loadingBilling && <CircleNotch aria-hidden className="h-3.5 w-3.5 animate-spin" />}
                  {loadingBilling ? "Carregando…" : "Ver cobranças"}
                </button>
              )}
            </div>
            <p role="status" aria-live="polite" className="sr-only">
              {loadingBilling ? "Buscando cobranças." : billing ? `${billing.length} cobrança(s) carregada(s).` : ""}
            </p>
            {billingMsg && <p className="text-xs text-muted-foreground">{billingMsg}</p>}
            {billing && billing.length > 0 && (
              <div className="rounded-[var(--radius)] border border-border divide-y divide-border">
                {billing.map((p) => {
                  const pm = paymentMeta(p.status);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2.5">
                      <Receipt aria-hidden className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium tabular-nums">{formatBRL(p.value)}</p>
                        <p className="text-xs text-muted-foreground">venc. {p.dueDate}{p.paymentDate ? ` · pago ${p.paymentDate}` : ""}</p>
                      </div>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${pm.cls}`}>{pm.label}</span>
                      {p.invoiceUrl && (
                        <a
                          href={p.invoiceUrl} target="_blank" rel="noopener noreferrer"
                          aria-label={`Abrir 2ª via da cobrança de ${formatBRL(p.value)}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius)] text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                          <ArrowSquareOut aria-hidden className="h-4 w-4" />
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
                      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                      <ChatCircle aria-hidden className="h-4 w-4" /> Cobrar no WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem telefone do dono</span>
                  )}
                  {mailHref && (
                    <a href={mailHref}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <Envelope aria-hidden className="h-4 w-4" /> E-mail
                    </a>
                  )}
                  {duePayment.invoiceUrl && (
                    <a href={duePayment.invoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <ArrowSquareOut aria-hidden className="h-4 w-4" /> 2ª via
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
