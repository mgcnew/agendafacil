"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { cn, formatBRL, monthRangeBR } from "@/lib/utils";
import {
  BarChart3,
  Wallet,
  TrendingDown,
  Coins,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  UsersRound,
  Download,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  UserRoundCheck,
  MessageCircle,
  Thermometer,
  Flame,
  Snowflake,
  BadgePercent,
} from "lucide-react";
import Link from "next/link";
import { exportReportCsv, exportReportPdf } from "./export";

export type ReportData = {
  faturamento: number;
  atendimentos: number;
  despesas: number;
  liquido: number;
  ticket_medio: number;
  by_payment: { method: string; total: number }[];
  daily: { day: string; total: number }[];
  services: { name: string; qty: number; total: number }[];
  professionals: { name: string; qty: number; revenue: number; commission: number }[];
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const shiftMonth = (cmes: string, by: number) => {
  const [y, m] = cmes.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (cmes: string) => {
  const [y, m] = cmes.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

type Tab = "financeiro" | "operacional" | "reativacao" | "temperatura";

export type HeatCell = { weekday: number; hour: number; revenue: number; count: number };
export type HeatWeekday = { weekday: number; revenue: number; count: number; occupation: number | null };
export type HeatmapData = { cells: HeatCell[]; weekdays: HeatWeekday[] };

export type ReactClient = {
  id: string;
  name: string;
  phone: string | null;
  visits: number;
  total_spent: number;
  expected_interval: number;
  days_since: number;
  last_visit: string;
  overdue_by: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  cartao: "Cartão",
};
const payLabel = (m: string) => PAYMENT_LABELS[m] ?? m;

export function ReportsView({
  salonId,
  salonName,
  slug,
  initialCmes,
  initialData,
  initialTab,
}: {
  salonId: string;
  salonName: string;
  slug: string;
  initialCmes: string;
  initialData: ReportData | null;
  initialTab?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cmes, setCmes] = useState(initialCmes);
  const [data, setData] = useState<ReportData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>(
    initialTab === "operacional" || initialTab === "reativacao" || initialTab === "temperatura"
      ? initialTab
      : "financeiro",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reativação carrega sob demanda (não depende do período)
  const [react, setReact] = useState<ReactClient[] | null>(null);
  const [reactLoading, setReactLoading] = useState(false);

  // Temperatura (heatmap) — depende do período; recarrega ao abrir a aba ou trocar de mês
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [heatLoading, setHeatLoading] = useState(false);
  const [heatCmes, setHeatCmes] = useState<string | null>(null);

  const loadHeatmap = useCallback(
    async (target: string) => {
      setHeatLoading(true);
      setHeatCmes(target);
      const { start, end } = monthRangeBR(target);
      const res = await supabase.rpc("report_heatmap" as never, {
        p_salon: salonId,
        p_from: start,
        p_to: end,
      } as never);
      setHeatmap(((res as { data: HeatmapData | null }).data) ?? null);
      setHeatLoading(false);
    },
    [supabase, salonId],
  );

  useEffect(() => {
    if (tab === "temperatura" && heatCmes !== cmes && !heatLoading) loadHeatmap(cmes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cmes]);

  const loadReact = useCallback(async () => {
    setReactLoading(true);
    const res = await supabase.rpc("report_reactivation" as never, {
      p_salon: salonId,
      p_min_days: 14,
    } as never);
    setReact((((res as { data: ReactClient[] | null }).data) ?? []));
    setReactLoading(false);
  }, [supabase, salonId]);

  const selectTab = useCallback(
    (t: Tab) => {
      setTab(t);
      if (t === "reativacao" && react === null && !reactLoading) loadReact();
    },
    [react, reactLoading, loadReact],
  );

  // Se a aba inicial for reativação (deep-link do dashboard), já carrega
  useEffect(() => {
    if (tab === "reativacao" && react === null && !reactLoading) loadReact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const isCurrent = cmes >= now;

  const load = useCallback(
    async (target: string) => {
      setCmes(target);
      setLoading(true);
      const { start, end } = monthRangeBR(target);
      const res = await supabase.rpc("report_overview" as never, {
        p_salon: salonId,
        p_from: start,
        p_to: end,
      } as never);
      setData(((res as { data: ReportData | null }).data) ?? null);
      setLoading(false);
    },
    [supabase, salonId],
  );

  const d = data;
  const isEmpty = !d || d.atendimentos === 0;

  function handleCsv() {
    if (d) exportReportCsv(d, monthLabel(cmes), `relatorio-${cmes}`);
    setMenuOpen(false);
  }
  async function handlePdf() {
    if (!d) return;
    setExporting(true);
    try {
      await exportReportPdf(d, monthLabel(cmes), `relatorio-${cmes}`);
    } finally {
      setExporting(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Relatórios
          </h1>
          <p className="text-muted-foreground text-sm">Desempenho do seu salão no período.</p>
        </div>

        <div className="flex items-center gap-2">
        {/* Exportar */}
        <div className="relative">
          <button
            type="button"
            disabled={isEmpty || loading}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-40"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">Exportar</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <>
              <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 mt-1 z-20 w-44 rounded-[var(--radius)] border border-border bg-card p-1 shadow-lg">
                <button onClick={handlePdf} className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] px-2.5 py-2 text-sm hover:bg-muted">
                  <FileText className="h-4 w-4 text-red-600" /> PDF
                </button>
                <button onClick={handleCsv} className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] px-2.5 py-2 text-sm hover:bg-muted">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (CSV)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-1">
          <button
            onClick={() => load(shiftMonth(cmes, -1))}
            className="grid h-8 w-8 place-items-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7.5rem] text-center text-sm font-medium capitalize">
            {monthLabel(cmes)}
          </span>
          <button
            onClick={() => !isCurrent && load(shiftMonth(cmes, 1))}
            disabled={isCurrent}
            className="grid h-8 w-8 place-items-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1.5 border-b border-border overflow-x-auto no-scrollbar pb-2 sm:gap-1 sm:pb-0">
        {([
          { id: "financeiro", label: "Financeiro", icon: Wallet },
          { id: "operacional", label: "Serviços & Profissionais", icon: Sparkles },
          { id: "temperatura", label: "Temperatura", icon: Thermometer },
          { id: "reativacao", label: "Reativação", icon: UserRoundCheck },
        ] as const).map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center justify-center gap-2 font-medium whitespace-nowrap transition shrink-0",
                "rounded-full px-3.5 py-2 text-sm",
                on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                "sm:rounded-none sm:-mb-px sm:border-b-2 sm:px-3.5 sm:py-2.5 sm:bg-transparent",
                on
                  ? "sm:border-primary sm:text-primary"
                  : "sm:border-transparent sm:hover:bg-transparent sm:hover:text-foreground",
              )}
            >
              <t.icon className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" />
              <span className={cn("leading-none", on ? "inline" : "hidden", "sm:inline")}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "temperatura" ? (
        <TemperaturaTab data={heatmap} loading={heatLoading} slug={slug} />
      ) : tab === "reativacao" ? (
        <ReativacaoTab clients={react} loading={reactLoading} salonName={salonName} slug={slug} />
      ) : loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">Sem dados neste período</p>
          <p className="text-sm text-muted-foreground mt-1">
            Os relatórios aparecem conforme os atendimentos são concluídos.
          </p>
        </div>
      ) : tab === "financeiro" ? (
        <FinanceiroTab d={d!} />
      ) : (
        <OperacionalTab d={d!} />
      )}
    </div>
  );
}

/* ───────────────────────── Financeiro ───────────────────────── */

function FinanceiroTab({ d }: { d: ReportData }) {
  const kpis = [
    { icon: Wallet, label: "Faturamento", value: formatBRL(d.faturamento), tone: "text-primary" },
    { icon: TrendingDown, label: "Despesas", value: formatBRL(d.despesas), tone: "text-red-600" },
    { icon: Coins, label: "Líquido", value: formatBRL(d.liquido), tone: d.liquido >= 0 ? "text-emerald-600" : "text-red-600" },
    { icon: Receipt, label: "Ticket médio", value: formatBRL(d.ticket_medio), sub: `${d.atendimentos} atendimento${d.atendimentos === 1 ? "" : "s"}` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5 min-w-0">
            <k.icon className={cn("h-5 w-5", k.tone ?? "text-primary")} />
            <p className="font-display text-xl sm:text-2xl font-bold mt-3 break-words tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            {k.sub && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{k.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 min-w-0">
          <h2 className="font-display font-semibold mb-4">Faturamento por dia</h2>
          <DailyBars daily={d.daily} />
        </Card>

        <Card className="p-5 min-w-0">
          <h2 className="font-display font-semibold mb-4">Formas de pagamento</h2>
          {d.by_payment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-3">
              {d.by_payment.map((p) => {
                const pct = d.faturamento > 0 ? (p.total / d.faturamento) * 100 : 0;
                return (
                  <div key={p.method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{payLabel(p.method)}</span>
                      <span className="font-medium">{formatBRL(p.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function DailyBars({ daily }: { daily: { day: string; total: number }[] }) {
  if (daily.length === 0) return <p className="text-sm text-muted-foreground">Sem faturamento no período.</p>;
  const max = Math.max(...daily.map((x) => x.total), 1);
  return (
    <div className="flex items-end gap-1 h-40 overflow-x-auto no-scrollbar">
      {daily.map((x) => {
        const h = Math.max((x.total / max) * 100, 2);
        const dayNum = x.day.slice(8, 10);
        return (
          <div key={x.day} className="flex h-full flex-col items-center gap-1 shrink-0" style={{ width: 22 }}>
            <div className="flex-1 flex items-end w-full">
              <div
                className="w-full rounded-t bg-primary/80 hover:bg-primary transition-all"
                style={{ height: `${h}%` }}
                title={`${dayNum}: ${formatBRL(x.total)}`}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{dayNum}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Reativação ───────────────────────── */

const firstName = (n: string) => (n || "").trim().split(" ")[0] || "tudo bem";

function ReativacaoTab({
  clients,
  loading,
  salonName,
  slug,
}: {
  clients: ReactClient[] | null;
  loading: boolean;
  salonName: string;
  slug: string;
}) {
  // origin só fica disponível no cliente — definir via efeito evita
  // divergência de hidratação no href do WhatsApp.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (loading || clients === null) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (clients.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border p-12 text-center">
        <UserRoundCheck className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 font-medium">Ninguém para reativar 🎉</p>
        <p className="text-sm text-muted-foreground mt-1">
          Suas clientes estão em dia com o ritmo habitual de retorno.
        </p>
      </div>
    );
  }

  const bookingLink = `${origin}/${slug}`;
  const waHref = (c: ReactClient) => {
    const digits = (c.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    const msg = `Oi, ${firstName(c.name)}! 💜 Sentimos sua falta aqui no ${salonName}. Que tal agendar um horário? ${bookingLink}`;
    return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Clientes que passaram do próprio ritmo de retorno — ordenados por urgência e valor.
        Mande um oi pelo WhatsApp e traga ela de volta. 💬
      </p>
      <div className="space-y-2">
        {clients.map((c) => {
          const href = waHref(c);
          return (
            <Card key={c.id} className="p-4 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 sm:flex-1">
                <p className="font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Há <span className="font-medium text-foreground">{c.days_since} dias</span> sem vir
                  {" · "}costuma a cada ~{c.expected_interval}d{" · "}{c.visits} visita{c.visits === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end sm:ml-auto">
                <span className="text-sm font-medium tabular-nums">{formatBRL(c.total_spent)}</span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 shrink-0 rounded-[var(--radius)] bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">sem telefone</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Temperatura ───────────────────────── */

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Temp = "quente" | "morno" | "frio";

function TempBadge({ t }: { t: Temp | null }) {
  if (t === null)
    return <span className="text-xs text-muted-foreground">Fechado</span>;
  const map = {
    quente: { icon: Flame, label: "Quente", cls: "bg-orange-500/15 text-orange-600" },
    morno: { icon: Thermometer, label: "Morno", cls: "bg-amber-500/15 text-amber-600" },
    frio: { icon: Snowflake, label: "Frio", cls: "bg-sky-500/15 text-sky-600" },
  }[t];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", map.cls)}>
      <Icon className="h-3.5 w-3.5" /> {map.label}
    </span>
  );
}

function TemperaturaTab({
  data,
  loading,
  slug,
}: {
  data: HeatmapData | null;
  loading: boolean;
  slug: string;
}) {
  if (loading || data === null) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalCount = data.weekdays.reduce((s, w) => s + w.count, 0);
  if (totalCount === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border p-12 text-center">
        <Thermometer className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 font-medium">Sem movimento neste período</p>
        <p className="text-sm text-muted-foreground mt-1">
          Conforme os atendimentos acontecem, mostramos seus dias e horários quentes e frios.
        </p>
      </div>
    );
  }

  const maxRev = Math.max(...data.weekdays.map((w) => w.revenue), 1);
  const temp = (w: HeatWeekday): Temp | null => {
    if (w.occupation === null) return null; // fechado
    const r = w.revenue / maxRev;
    if (r >= 0.66) return "quente";
    if (r >= 0.33) return "morno";
    return "frio";
  };

  // Heatmap dia × hora
  const cellMap = new Map<string, HeatCell>();
  for (const c of data.cells) cellMap.set(`${c.weekday}-${c.hour}`, c);
  const maxCell = Math.max(...data.cells.map((c) => c.revenue), 1);
  const hoursWithData = data.cells.map((c) => c.hour);
  const minH = hoursWithData.length ? Math.min(...hoursWithData) : 9;
  const maxH = hoursWithData.length ? Math.max(...hoursWithData) : 18;
  const hourRange: number[] = [];
  for (let h = minH; h <= maxH; h++) hourRange.push(h);

  return (
    <div className="space-y-6">
      {/* Termômetro por dia da semana */}
      <Card className="p-5 min-w-0">
        <h2 className="font-display font-semibold">Termômetro por dia da semana</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quente = mais movimento e faturamento; frio = oportunidade de aquecer com uma promoção.
        </p>
        <div className="mt-4 space-y-2">
          {data.weekdays.map((w) => {
            const t = temp(w);
            return (
              <div key={w.weekday} className="rounded-[var(--radius)] border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{WEEKDAYS[w.weekday]}</span>
                  <TempBadge t={t} />
                </div>
                {t !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ocupação <span className="font-medium text-foreground">{w.occupation}%</span>
                    {" · "}{formatBRL(w.revenue)}{" · "}{w.count} atend.
                  </p>
                )}
                {t === "frio" && (
                  <Link
                    href={`/painel/${slug}/campanhas?nova=1&nome=${encodeURIComponent(`Esquenta ${WEEKDAYS[w.weekday]}`)}&desconto=15`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <BadgePercent className="h-3.5 w-3.5" /> Criar promoção para aquecer este dia
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Heatmap dia × hora */}
      {data.cells.length > 0 && (
        <Card className="p-5 min-w-0">
          <h2 className="font-display font-semibold">Movimento por dia e horário</h2>
          <p className="text-sm text-muted-foreground mt-1">Mais escuro = mais faturamento naquele horário.</p>
          <div className="mt-4 overflow-x-auto no-scrollbar">
            <div className="min-w-[16rem]">
              {/* Cabeçalho */}
              <div className="grid" style={{ gridTemplateColumns: "2.5rem repeat(7, minmax(2rem, 1fr))" }}>
                <div />
                {WEEKDAYS_SHORT.map((d) => (
                  <div key={d} className="text-center text-[11px] font-medium text-muted-foreground pb-1">{d}</div>
                ))}
              </div>
              {/* Linhas por hora */}
              {hourRange.map((h) => (
                <div key={h} className="grid items-center" style={{ gridTemplateColumns: "2.5rem repeat(7, minmax(2rem, 1fr))" }}>
                  <div className="text-[10px] text-muted-foreground tabular-nums pr-1 text-right">{String(h).padStart(2, "0")}h</div>
                  {Array.from({ length: 7 }, (_, wd) => {
                    const cell = cellMap.get(`${wd}-${h}`);
                    const intensity = cell ? cell.revenue / maxCell : 0;
                    return (
                      <div key={wd} className="px-0.5 py-0.5">
                        <div
                          className="h-6 rounded-sm border border-border/40"
                          style={{
                            backgroundColor: intensity > 0
                              ? `color-mix(in srgb, var(--primary) ${Math.round(15 + intensity * 85)}%, transparent)`
                              : "transparent",
                          }}
                          title={cell ? `${WEEKDAYS_SHORT[wd]} ${h}h · ${formatBRL(cell.revenue)} · ${cell.count} atend.` : `${WEEKDAYS_SHORT[wd]} ${h}h · sem movimento`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────── Serviços & Profissionais ─────────────────── */

function OperacionalTab({ d }: { d: ReportData }) {
  const maxSvc = Math.max(...d.services.map((s) => s.total), 1);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 min-w-0">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-primary" /> Serviços mais vendidos
        </h2>
        {d.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="space-y-3">
            {d.services.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between gap-2 text-sm mb-1">
                  <span className="truncate">{s.name} <span className="text-muted-foreground">· {s.qty}x</span></span>
                  <span className="font-medium shrink-0">{formatBRL(s.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(s.total / maxSvc) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 min-w-0">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          <UsersRound className="h-4.5 w-4.5 text-primary" /> Desempenho por profissional
        </h2>
        {d.professionals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="font-medium px-1 py-1.5">Profissional</th>
                  <th className="font-medium px-1 py-1.5 text-right">Atend.</th>
                  <th className="font-medium px-1 py-1.5 text-right">Receita</th>
                  <th className="font-medium px-1 py-1.5 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {d.professionals.map((p) => (
                  <tr key={p.name} className="border-t border-border">
                    <td className="px-1 py-2 truncate max-w-[8rem]">{p.name}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{p.qty}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{formatBRL(p.revenue)}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">{formatBRL(p.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
