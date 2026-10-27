"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { tablistKeys } from "@/lib/tablistKeys";
import { cn, formatBRL, monthRangeBR } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChatCircle,
  CircleNotch,
  Coins,
  DownloadSimple,
  FileText,
  FileXls,
  Flame,
  Receipt,
  SealPercent,
  Snowflake,
  Sparkle,
  Thermometer,
  TrendDown,
  UserCheck,
  Users,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { exportReportCsv, exportReportPdf } from "./export";
import { Narrator, narratorPct as pct } from "@/components/Narrator";
import { SITE_URL } from "@/lib/siteUrl";
import { SERVICE_COLORS } from "@/lib/serviceColors";

// URL canônica (produção) — vai dentro da mensagem de WhatsApp; NEXT_PUBLIC_ é
// embutida no build, igual no servidor/cliente, sem o render duplo do antigo
// useEffect(setOrigin).

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

/** Cor e foto de cada serviço/profissional, casados pelo nome do relatório. */
export type Identidades = {
  servicos: Record<string, string>;
  profissionais: Record<string, { cor: string | null; foto: string | null }>;
};

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

const shiftMonthPrev = (cmes: string) => shiftMonth(cmes, -1);

export function ReportsView({
  salonId,
  salonName,
  slug,
  initialCmes,
  initialData,
  initialPrevData,
  initialTab,
  identidades = { servicos: {}, profissionais: {} },
}: {
  salonId: string;
  salonName: string;
  slug: string;
  initialCmes: string;
  initialData: ReportData | null;
  initialPrevData?: ReportData | null;
  initialTab?: string;
  identidades?: Identidades;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cmes, setCmes] = useState(initialCmes);
  const [data, setData] = useState<ReportData | null>(initialData);
  const [prevData, setPrevData] = useState<ReportData | null>(initialPrevData ?? null);
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
      const { start: prevStart, end: prevEnd } = monthRangeBR(shiftMonthPrev(target));
      const [res, prevRes] = await Promise.all([
        supabase.rpc("report_overview" as never, {
          p_salon: salonId,
          p_from: start,
          p_to: end,
        } as never),
        supabase.rpc("report_overview" as never, {
          p_salon: salonId,
          p_from: prevStart,
          p_to: prevEnd,
        } as never),
      ]);
      setData(((res as { data: ReportData | null }).data) ?? null);
      setPrevData(((prevRes as { data: ReportData | null }).data) ?? null);
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
    <div className="space-y-6 af-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ChartBar className="h-6 w-6 text-primary" /> Relatórios
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
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            // No celular sobra só o ícone: sem isto o botão fica sem nome.
            aria-label={exporting ? "Exportando…" : "Exportar relatório"}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40"
          >
            {exporting
              ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
              : <DownloadSimple aria-hidden className="h-4 w-4" />}
            <span className="hidden sm:inline">Exportar</span>
            <CaretDown aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <>
              <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
              <div
                role="menu"
                aria-label="Formato do arquivo"
                onKeyDown={(e) => { if (e.key === "Escape") setMenuOpen(false); }}
                className="absolute left-0 mt-1 z-20 w-44 rounded-[var(--radius)] border border-border bg-card p-1 shadow-lg"
              >
                <button
                  type="button" role="menuitem" onClick={handlePdf}
                  className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] px-2.5 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:bg-muted"
                >
                  <FileText aria-hidden className="h-4 w-4 text-red-600" /> PDF
                </button>
                <button
                  type="button" role="menuitem" onClick={handleCsv}
                  className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] px-2.5 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:bg-muted"
                >
                  <FileXls aria-hidden className="h-4 w-4 text-emerald-600" /> Excel (CSV)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => load(shiftMonth(cmes, -1))}
            className="grid h-9 w-9 place-items-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Mês anterior"
          >
            <CaretLeft aria-hidden className="h-4 w-4" />
          </button>
          <span aria-live="polite" className="min-w-[7.5rem] text-center text-sm font-medium capitalize">
            {monthLabel(cmes)}
          </span>
          <button
            type="button"
            onClick={() => !isCurrent && load(shiftMonth(cmes, 1))}
            disabled={isCurrent}
            className="grid h-9 w-9 place-items-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40"
            aria-label="Próximo mês"
          >
            <CaretRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
        </div>
      </div>

      {/* Abas */}
      <div
        role="tablist"
        aria-label="Relatórios"
        onKeyDown={tablistKeys(
          ["financeiro", "operacional", "temperatura", "reativacao"] as const,
          tab,
          selectTab,
        )}
        className="flex gap-1.5 border-b border-border overflow-x-auto no-scrollbar pb-2 sm:gap-1 sm:pb-0"
      >
        {([
          { id: "financeiro", label: "Financeiro", icon: Wallet },
          { id: "operacional", label: "Serviços & Profissionais", icon: Sparkle },
          { id: "temperatura", label: "Temperatura", icon: Thermometer },
          { id: "reativacao", label: "Reativação", icon: UserCheck },
        ] as const).map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={cn(
                "flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition",
                "rounded-full px-3.5 py-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                "sm:rounded-none sm:-mb-px sm:border-b-2 sm:px-3.5 sm:py-2.5 sm:bg-transparent",
                on
                  ? "sm:border-primary sm:text-primary"
                  : "sm:border-transparent sm:hover:bg-transparent sm:hover:text-foreground",
              )}
            >
              <t.icon aria-hidden className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" />
              {/* No celular a aba inativa some o rótulo e fica só o ícone —
                  para o leitor de tela ela ficava sem nome nenhum. O texto
                  continua existindo, só que escondido de quem enxerga. */}
              <span className={cn("leading-none", on ? "inline" : "sr-only", "sm:not-sr-only sm:inline")}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "temperatura" ? (
        <TemperaturaTab data={heatmap} loading={heatLoading} slug={slug} />
      ) : tab === "reativacao" ? (
        <ReativacaoTab clients={react} loading={reactLoading} salonName={salonName} slug={slug} />
      ) : loading ? (
        <Carregando texto="Carregando o relatório…" />
      ) : isEmpty ? (
        <Vazio
          icon={ChartBar}
          titulo="Sem dados neste período"
          texto="Os relatórios aparecem conforme os atendimentos são concluídos."
        />
      ) : tab === "financeiro" ? (
        <FinanceiroTab d={d!} prev={prevData} prevLabel={monthLabel(shiftMonthPrev(cmes))} slug={slug} cmes={cmes} />
      ) : (
        <OperacionalTab d={d!} prev={prevData} prevLabel={monthLabel(shiftMonthPrev(cmes))} identidades={identidades} />
      )}
    </div>
  );
}

/* ───────────────────────── Peças comuns ───────────────────────── */

/**
 * Variação contra o mês anterior, embaixo de cada número. Seta + texto: a cor
 * (verde/vermelho) nunca carrega o sentido sozinha. Despesa que sobe é ruim,
 * por isso `menorMelhor`.
 */
function Variacao({
  atual,
  anterior,
  mesAnterior,
  menorMelhor = false,
}: {
  atual: number;
  anterior: number | undefined;
  mesAnterior: string;
  menorMelhor?: boolean;
}) {
  if (!anterior || anterior <= 0) return null;
  const delta = ((atual - anterior) / anterior) * 100;
  const curto = mesAnterior.split(" ")[0].slice(0, 3).toLowerCase();
  if (Math.abs(delta) < 0.5) {
    return <p className="mt-1.5 text-xs text-muted-foreground">igual a {curto}</p>;
  }
  const subiu = delta > 0;
  const bom = menorMelhor ? !subiu : subiu;
  const Seta = subiu ? ArrowUp : ArrowDown;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-semibold tabular-nums",
          bom ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        <Seta aria-hidden weight="bold" className="h-3 w-3" />
        {pct(Math.abs(delta))}
      </span>
      <span className="text-muted-foreground">vs {curto}</span>
    </p>
  );
}

function Vazio({ icon: Icon, titulo, texto }: { icon: typeof ChartBar; titulo: string; texto: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-border p-12 text-center">
      <Icon aria-hidden className="mx-auto h-8 w-8 text-muted-foreground/50" />
      <p className="mt-3 font-medium">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1">{texto}</p>
    </div>
  );
}

function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div role="status" className="grid place-items-center py-20 text-muted-foreground">
      <CircleNotch aria-hidden className="h-6 w-6 animate-spin" />
      <span className="sr-only">{texto}</span>
    </div>
  );
}

/** Foto da profissional, ou a inicial na cor dela (a mesma da Agenda). */
function Avatar({ nome, cor, foto }: { nome: string; cor?: string | null; foto?: string | null }) {
  const inicial = (nome.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-secondary" />;
  }
  // Sem cor própria (cliente): fundo neutro, que dá contraste em qualquer tema.
  if (!cor) {
    return (
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
        {inicial}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: cor }}
    >
      {inicial}
    </span>
  );
}

/* ───────────────────────── Financeiro ───────────────────────── */

function financeiroNarration(d: ReportData, prev: ReportData | null, prevLabel: string) {
  const lines: string[] = [];
  let alert: string | undefined;
  if (!prev || prev.atendimentos === 0) {
    lines.push(`Faturamento de ${formatBRL(d.faturamento)} este mês, com ${d.atendimentos} atendimento${d.atendimentos === 1 ? "" : "s"}.`);
    return { lines, alert };
  }
  if (prev.faturamento > 0) {
    const delta = ((d.faturamento - prev.faturamento) / prev.faturamento) * 100;
    const dir = delta >= 0 ? "a mais" : "a menos";
    lines.push(`Faturamento de ${formatBRL(d.faturamento)} este mês, ${pct(delta)} ${dir} que em ${prevLabel}.`);
  } else {
    lines.push(`Faturamento de ${formatBRL(d.faturamento)} este mês.`);
  }
  if (prev.ticket_medio > 0 && d.ticket_medio > 0) {
    const deltaTicket = ((d.ticket_medio - prev.ticket_medio) / prev.ticket_medio) * 100;
    if (Math.abs(deltaTicket) >= 5) {
      lines.push(`Ticket médio ${deltaTicket >= 0 ? "subiu" : "caiu"} pra ${formatBRL(d.ticket_medio)} (${pct(deltaTicket)}).`);
    }
  }
  if (d.faturamento > 0 && prev.faturamento > 0) {
    const marginNow = d.despesas / d.faturamento;
    const marginPrev = prev.despesas / prev.faturamento;
    if (marginNow - marginPrev >= 0.05) {
      alert = `Suas despesas cresceram mais rápido que o faturamento: hoje elas representam ${pct(marginNow * 100)} da receita, contra ${pct(marginPrev * 100)} em ${prevLabel}. Vale revisar o que mudou.`;
    }
  }
  return { lines, alert };
}

// Cor fixa por forma de pagamento (segue a forma, não a posição): Pix é
// sempre azul, mesmo no mês em que fica em terceiro.
const COR_PAGAMENTO: Record<string, string> = {
  pix: "var(--series-1)",
  credito: "var(--series-2)",
  debito: "var(--series-3)",
  dinheiro: "var(--series-4)",
  cartao: "var(--series-5)",
};
const corPagamento = (m: string) => COR_PAGAMENTO[m] ?? "var(--muted-foreground)";

function FinanceiroTab({
  d, prev, prevLabel, slug, cmes,
}: {
  d: ReportData; prev: ReportData | null; prevLabel: string; slug: string; cmes: string;
}) {
  const kpis = [
    { icon: Wallet, label: "Faturamento", value: d.faturamento, anterior: prev?.faturamento, tone: "text-primary" },
    { icon: TrendDown, label: "Despesas", value: d.despesas, anterior: prev?.despesas, tone: "text-red-600", menorMelhor: true },
    { icon: Coins, label: "Líquido", value: d.liquido, anterior: prev?.liquido, tone: d.liquido >= 0 ? "text-emerald-600" : "text-red-600" },
    { icon: Receipt, label: "Ticket médio", value: d.ticket_medio, anterior: prev?.ticket_medio, sub: `${d.atendimentos} atendimento${d.atendimentos === 1 ? "" : "s"}` },
  ];
  const { lines, alert } = financeiroNarration(d, prev, prevLabel);
  const pagamentos = [...d.by_payment].sort((a, b) => b.total - a.total);
  const totalPago = pagamentos.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      <Narrator lines={lines} alert={alert} />
      {alert && (
        <div className="-mt-3 flex flex-wrap gap-3 text-xs">
          <Link href={`/painel/${slug}/relatorios?tab=temperatura`} className="font-semibold text-primary hover:underline">
            Ver dias e horários mais fracos →
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <k.icon aria-hidden className={cn("h-4 w-4", k.tone ?? "text-primary")} />
              {k.label}
            </div>
            <p className="font-display text-xl sm:text-2xl font-bold mt-2 break-words tabular-nums">{formatBRL(k.value)}</p>
            <Variacao atual={k.value} anterior={k.anterior} mesAnterior={prevLabel} menorMelhor={k.menorMelhor} />
            {k.sub && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{k.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 min-w-0">
          <DailyBars daily={d.daily} cmes={cmes} />
        </Card>

        <Card className="p-5 min-w-0">
          <h2 className="font-display font-semibold">Formas de pagamento</h2>
          {pagamentos.length === 0 || totalPago <= 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Sem pagamentos registrados.</p>
          ) : (
            <>
              {/* Barra de partes do todo: 2px de fundo entre os pedaços. */}
              <div
                role="img"
                aria-label={pagamentos.map((p) => `${payLabel(p.method)} ${pct((p.total / totalPago) * 100)}`).join(", ")}
                className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full"
              >
                {pagamentos.map((p) => (
                  <div
                    key={p.method}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(p.total / totalPago) * 100}%`, backgroundColor: corPagamento(p.method) }}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                {pagamentos.map((p) => (
                  <li key={p.method} className="flex items-center gap-2.5 text-sm">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corPagamento(p.method) }} />
                    <span className="min-w-0 flex-1 truncate">{payLabel(p.method)}</span>
                    <span className="text-muted-foreground tabular-nums">{pct((p.total / totalPago) * 100)}</span>
                    <span className="w-24 text-right font-medium tabular-nums">{formatBRL(p.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * Faturamento por dia, com o mês inteiro no eixo: dia sem movimento aparece
 * como vazio (antes sumia, e a semana parada não se via). Uma série só, então
 * uma cor só — o melhor dia ganha destaque e a linha tracejada é a média dos
 * dias com movimento.
 */
function DailyBars({ daily, cmes }: { daily: { day: string; total: number }[]; cmes: string }) {
  const [y, m] = cmes.split("-").map(Number);
  const nDias = new Date(y, m, 0).getDate();
  const porDia = new Map(daily.map((x) => [Number(x.day.slice(8, 10)), x.total]));
  const agora = new Date();
  const mesAtual = agora.getFullYear() === y && agora.getMonth() + 1 === m;
  const hoje = mesAtual ? agora.getDate() : null;

  const dias = Array.from({ length: nDias }, (_, i) => {
    const dia = i + 1;
    return { dia, total: porDia.get(dia) ?? 0, futuro: hoje !== null && dia > hoje };
  });
  const comMovimento = dias.filter((x) => x.total > 0);
  const max = Math.max(...dias.map((x) => x.total), 1);
  const media = comMovimento.length ? comMovimento.reduce((s, x) => s + x.total, 0) / comMovimento.length : 0;
  const melhor = comMovimento.reduce<(typeof dias)[number] | null>((a, b) => (!a || b.total > a.total ? b : a), null);
  const semana = (dia: number) => WEEKDAYS_SHORT[new Date(y, m - 1, dia).getDay()];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display font-semibold">Faturamento por dia</h2>
        {comMovimento.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {melhor && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
                Melhor dia: <b className="font-semibold text-foreground tabular-nums">{melhor.dia}, {formatBRL(melhor.total)}</b>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-2 border-dashed border-foreground/40" />
              Média <b className="font-semibold text-foreground tabular-nums">{formatBRL(media)}</b>/dia
            </span>
          </p>
        )}
      </div>

      {comMovimento.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Sem faturamento no período.</p>
      ) : (
        <>
          <div className="relative mt-5 h-44">
            {/* Grade: só o topo e a média — o resto é ruído. */}
            <div aria-hidden className="absolute inset-x-0 top-0 border-t border-border/70" />
            <span aria-hidden className="absolute -top-2 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted-foreground">
              {formatBRL(max)}
            </span>
            <div
              aria-hidden
              className="absolute inset-x-0 z-10 border-t-2 border-dashed border-foreground/35 pointer-events-none"
              style={{ bottom: `${(media / max) * 100}%` }}
            />
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {dias.map((x) => {
                const destaque = melhor?.dia === x.dia;
                const altura = x.total > 0 ? Math.max((x.total / max) * 100, 3) : 0;
                return (
                  <div key={x.dia} className="group relative flex h-full flex-1 items-end">
                    {x.total > 0 ? (
                      <div
                        className={cn(
                          "w-full rounded-t-[4px] transition-colors",
                          destaque ? "bg-primary" : "bg-primary/45 dark:bg-primary/60 group-hover:bg-primary/75",
                        )}
                        style={{ height: `${altura}%` }}
                      />
                    ) : (
                      // Dia parado: um traço no chão, para o vazio ser visível.
                      !x.futuro && <div className="h-[3px] w-full rounded-full bg-border" />
                    )}
                    {/* Dica ao passar o mouse */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {semana(x.dia)}, {x.dia} · {x.futuro ? "ainda não chegou" : formatBRL(x.total)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Eixo: dia 1 e de 5 em 5; hoje marcado. */}
          <div aria-hidden className="mt-1.5 flex gap-[2px]">
            {dias.map((x) => (
              <span
                key={x.dia}
                className={cn(
                  "flex-1 text-center text-[10px] tabular-nums",
                  x.dia === hoje ? "font-bold text-foreground" : "text-muted-foreground",
                )}
              >
                {x.dia === 1 || x.dia % 5 === 0 || x.dia === hoje ? x.dia : ""}
              </span>
            ))}
          </div>
          {/* Para leitor de tela: os mesmos números, em lista. */}
          <ul className="sr-only">
            {comMovimento.map((x) => (
              <li key={x.dia}>Dia {x.dia}: {formatBRL(x.total)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Reativação ───────────────────────── */

const firstName = (n: string) => (n || "").trim().split(" ")[0] || "tudo bem";

/** Quanto passou do ritmo, em relação ao próprio ritmo dela. */
function urgencia(c: ReactClient): { rotulo: string; cls: string } {
  const r = c.expected_interval > 0 ? c.overdue_by / c.expected_interval : 1;
  if (r >= 1) return { rotulo: "Muito atrasada", cls: "bg-red-500/12 text-red-700 dark:text-red-400" };
  if (r >= 0.4) return { rotulo: "Atrasada", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-400" };
  return { rotulo: "Passou do ritmo", cls: "bg-secondary text-secondary-foreground" };
}

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
  if (loading || clients === null) return <Carregando />;
  if (clients.length === 0) {
    return (
      <Vazio
        icon={UserCheck}
        titulo="Ninguém para reativar 🎉"
        texto="Suas clientes estão em dia com o ritmo habitual de retorno."
      />
    );
  }

  const bookingLink = `${SITE_URL}/${slug}`;
  const waHref = (c: ReactClient) => {
    const digits = (c.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    const msg = `Oi, ${firstName(c.name)}! 💜 Sentimos sua falta aqui no ${salonName}. Que tal agendar um horário? ${bookingLink}`;
    return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
  };

  const urgent = [...clients].sort((a, b) => b.overdue_by - a.overdue_by)[0];
  const emJogo = clients.reduce((s, c) => s + (c.visits > 0 ? c.total_spent / c.visits : 0), 0);

  return (
    <div className="space-y-4">
      <Narrator
        lines={[
          `Você tem ${clients.length} cliente${clients.length === 1 ? "" : "s"} que já passou do próprio ritmo de retorno.` +
            (urgent
              ? ` A mais urgente é ${firstName(urgent.name)}, ${urgent.overdue_by} dia${urgent.overdue_by === 1 ? "" : "s"} além do previsto.`
              : ""),
        ]}
      />

      {/* Quanto volta se cada uma vier uma vez: o número que faz valer o oi. */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Para reativar</p>
          <p className="font-display text-xl sm:text-2xl font-bold mt-2 tabular-nums">{clients.length}</p>
        </Card>
        <Card className="p-5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Se cada uma voltar uma vez</p>
          <p className="font-display text-xl sm:text-2xl font-bold mt-2 tabular-nums">{formatBRL(emJogo)}</p>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Ordenadas por urgência e valor. Para mandar pelo número do salão, sem sair do painel, use{" "}
        <Link href={`/painel/${slug}/recuperar`} className="font-medium text-primary hover:underline">Recuperar</Link>.
      </p>

      <ul className="space-y-2">
        {clients.map((c) => {
          const href = waHref(c);
          const u = urgencia(c);
          return (
            <li key={c.id}>
              <Card className="p-4 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <Avatar nome={c.name} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", u.cls)}>
                        +{c.overdue_by} dia{c.overdue_by === 1 ? "" : "s"} · {u.rotulo}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Há <span className="font-medium text-foreground">{c.days_since} dias</span> sem vir
                      {" · "}costuma a cada ~{c.expected_interval}d{" · "}{c.visits} visita{c.visits === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end sm:ml-auto">
                  <span className="text-sm font-medium tabular-nums">
                    {formatBRL(c.total_spent)}
                    <span className="block text-[11px] font-normal text-muted-foreground sm:text-right">no total</span>
                  </span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 shrink-0 rounded-[var(--radius)] bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                      <ChatCircle aria-hidden className="h-4 w-4" /> WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">sem telefone</span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────────────────── Temperatura ───────────────────────── */

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Temp = "quente" | "morno" | "frio";

// Cor de estado (quente/morno/frio), sempre com ícone + palavra ao lado.
const TEMP = {
  quente: { icon: Flame, label: "Quente", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400", barra: "bg-orange-500" },
  morno: { icon: Thermometer, label: "Morno", badge: "bg-amber-500/15 text-amber-800 dark:text-amber-400", barra: "bg-amber-400" },
  frio: { icon: Snowflake, label: "Frio", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400", barra: "bg-sky-500" },
} as const;

function TempBadge({ t }: { t: Temp | null }) {
  if (t === null) return <span className="text-xs text-muted-foreground">Fechado</span>;
  const map = TEMP[t];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", map.badge)}>
      <Icon aria-hidden className="h-3.5 w-3.5" /> {map.label}
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
  if (loading || data === null) return <Carregando />;

  const totalCount = data.weekdays.reduce((s, w) => s + w.count, 0);
  if (totalCount === 0) {
    return (
      <Vazio
        icon={Thermometer}
        titulo="Sem movimento neste período"
        texto="Conforme os atendimentos acontecem, mostramos seus dias e horários quentes e frios."
      />
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
  // Uma cor só, do claro ao escuro (sequencial): mais escuro = mais faturamento.
  const tom = (i: number) => `color-mix(in srgb, var(--primary) ${Math.round(12 + i * 88)}%, transparent)`;

  const openDays = data.weekdays.filter((w) => w.occupation !== null);
  const hottest = [...openDays].sort((a, b) => b.revenue - a.revenue)[0];
  const coldest = [...openDays].sort((a, b) => a.revenue - b.revenue)[0];
  const narratorLines: string[] = [];
  if (hottest) {
    narratorLines.push(`${WEEKDAYS[hottest.weekday]} é seu dia mais quente: ${formatBRL(hottest.revenue)} e ${hottest.occupation}% de ocupação.`);
  }
  let coldAlert: string | undefined;
  if (coldest && coldest.weekday !== hottest?.weekday && temp(coldest) === "frio") {
    coldAlert = `${WEEKDAYS[coldest.weekday]} está frio, só ${coldest.occupation}% de ocupação. Dá pra usar a promoção abaixo pra aquecer.`;
  }

  return (
    <div className="space-y-6">
      <Narrator lines={narratorLines} alert={coldAlert} />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Termômetro: a barra é o faturamento contra o melhor dia (é o que
            define quente/morno/frio); a ocupação vai escrita embaixo. */}
        <Card className="p-5 min-w-0 lg:col-span-2">
          <h2 className="font-display font-semibold">Termômetro da semana</h2>
          <p className="text-sm text-muted-foreground mt-1">
            A barra compara o faturamento de cada dia com o do melhor dia. Frio é oportunidade de aquecer com uma promoção.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {data.weekdays.map((w) => {
              const t = temp(w);
              return (
                <li key={w.weekday} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-medium", t === null && "text-muted-foreground")}>{WEEKDAYS[w.weekday]}</span>
                    <TempBadge t={t} />
                  </div>
                  {t !== null && (
                    <>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", TEMP[t].barra)}
                          style={{ width: `${Math.max((w.revenue / maxRev) * 100, 2)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                        <span className="font-medium text-foreground">{w.occupation}%</span> ocupado
                        {" · "}{formatBRL(w.revenue)}{" · "}{w.count} atend.
                      </p>
                      {t === "frio" && (
                        <Link
                          href={`/painel/${slug}/campanhas?nova=1&nome=${encodeURIComponent(`Esquenta ${WEEKDAYS[w.weekday]}`)}&desconto=15`}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <SealPercent aria-hidden className="h-3.5 w-3.5" /> Criar promoção para aquecer este dia
                        </Link>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Heatmap dia × hora */}
        {data.cells.length > 0 && (
          <Card className="p-5 min-w-0 lg:col-span-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold">Movimento por dia e horário</h2>
                <p className="text-sm text-muted-foreground mt-1">Faturamento em cada hora da semana.</p>
              </div>
              {/* Legenda da escala */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
                Menos
                {[0.05, 0.3, 0.55, 0.8, 1].map((i) => (
                  <span key={i} className="h-3 w-3 rounded-[3px] border border-border/50" style={{ backgroundColor: tom(i) }} />
                ))}
                Mais
              </div>
            </div>
            <div className="mt-4 overflow-x-auto no-scrollbar">
              <div className="min-w-[16rem]">
                <div className="grid" style={{ gridTemplateColumns: "2.5rem repeat(7, minmax(2rem, 1fr))" }}>
                  <div />
                  {WEEKDAYS_SHORT.map((d) => (
                    <div key={d} className="text-center text-[11px] font-medium text-muted-foreground pb-1">{d}</div>
                  ))}
                </div>
                {hourRange.map((h) => (
                  <div key={h} className="grid items-center" style={{ gridTemplateColumns: "2.5rem repeat(7, minmax(2rem, 1fr))" }}>
                    <div className="text-[10px] text-muted-foreground tabular-nums pr-1.5 text-right">{String(h).padStart(2, "0")}h</div>
                    {Array.from({ length: 7 }, (_, wd) => {
                      const cell = cellMap.get(`${wd}-${h}`);
                      const intensity = cell ? cell.revenue / maxCell : 0;
                      return (
                        <div key={wd} className="p-[2px]">
                          <div
                            className={cn("h-6 rounded-[4px]", intensity > 0 ? "" : "bg-muted/60")}
                            style={intensity > 0 ? { backgroundColor: tom(intensity) } : undefined}
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
    </div>
  );
}

/* ─────────────────── Serviços & Profissionais ─────────────────── */

function operacionalNarration(d: ReportData, prev: ReportData | null, prevLabel: string) {
  const lines: string[] = [];
  let alert: string | undefined;

  const topPro = [...d.professionals].sort((a, b) => b.revenue - a.revenue)[0];
  if (topPro) {
    lines.push(`Destaque do mês: ${topPro.name}, com ${topPro.qty} atendimento${topPro.qty === 1 ? "" : "s"} e ${formatBRL(topPro.revenue)} em receita.`);
  }

  if (prev) {
    const prevByService = new Map(prev.services.map((s) => [s.name, s]));
    let worst: { name: string; delta: number } | null = null;
    for (const s of d.services) {
      const p = prevByService.get(s.name);
      if (!p || p.qty < 3) continue;
      const delta = ((s.qty - p.qty) / p.qty) * 100;
      if (delta <= -30 && (!worst || delta < worst.delta)) worst = { name: s.name, delta };
    }
    if (worst) {
      alert = `${worst.name} caiu ${pct(Math.abs(worst.delta))} em atendimentos em relação a ${prevLabel} — vale conferir se ainda está sendo bem divulgado.`;
    } else {
      const prevByPro = new Map(prev.professionals.map((p) => [p.name, p]));
      let bestGrowth: { name: string; delta: number } | null = null;
      for (const p of d.professionals) {
        const pv = prevByPro.get(p.name);
        if (!pv || pv.qty < 3) continue;
        const delta = ((p.qty - pv.qty) / pv.qty) * 100;
        if (delta >= 30 && (!bestGrowth || delta > bestGrowth.delta)) bestGrowth = { name: p.name, delta };
      }
      if (bestGrowth) {
        lines.push(`${bestGrowth.name} cresceu ${pct(bestGrowth.delta)} em atendimentos em relação a ${prevLabel}.`);
      }
    }
  }

  return { lines, alert };
}

// Mais de 8 serviços vira "Outros": cor nova a cada serviço deixa de distinguir.
const MAX_SERVICOS = 8;

/** Ponto de partida fixo pelo nome: o mesmo item cai na mesma cor todo mês. */
function indicePorNome(nome: string) {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % SERVICE_COLORS.length;
}

/**
 * Cor de cada item: a cadastrada (a mesma da Agenda) quando existe e não se
 * repete na lista. Sem cor, ou com a mesma cor de outro — o padrão de quem
 * nunca mexeu nisso —, o item ganha uma cor da paleta de serviços que ainda
 * não está em uso, partindo de um ponto fixo pelo nome. O passo de 5 em 5
 * espalha os tons pela paleta (vizinhos ficam longe: vermelho, verde, azul…).
 */
function coresDistintas(nomes: string[], cadastrada: (nome: string) => string | null | undefined) {
  const propria = new Map(nomes.map((n) => [n, cadastrada(n)?.toLowerCase() ?? null]));
  const contagem = new Map<string, number>();
  for (const c of propria.values()) if (c) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  const usadas = new Set([...contagem].filter(([, n]) => n === 1).map(([c]) => c));
  const paleta = SERVICE_COLORS.map((c) => c.toLowerCase());

  const cores = new Map<string, string>();
  for (const n of nomes) {
    const c = propria.get(n);
    if (c && contagem.get(c) === 1) {
      cores.set(n, c);
      continue;
    }
    const base = indicePorNome(n);
    let escolhida = paleta[(base * 5) % paleta.length];
    for (let k = 0; k < paleta.length; k++) {
      const cand = paleta[((base + k) * 5) % paleta.length];
      if (!usadas.has(cand)) { escolhida = cand; break; }
    }
    usadas.add(escolhida);
    cores.set(n, escolhida);
  }
  return cores;
}

function OperacionalTab({
  d, prev, prevLabel, identidades,
}: {
  d: ReportData; prev: ReportData | null; prevLabel: string; identidades: Identidades;
}) {
  const { lines, alert } = operacionalNarration(d, prev, prevLabel);

  const ordenados = [...d.services].sort((a, b) => b.total - a.total);
  const totalServicos = ordenados.reduce((s, x) => s + x.total, 0);
  // Sobrou um só depois do 8º: mostra ele mesmo, "Outros 1" não diz nada.
  const corte = ordenados.length > MAX_SERVICOS + 1 ? MAX_SERVICOS : ordenados.length;
  const visiveis = ordenados.slice(0, corte);
  const resto = ordenados.slice(corte);
  const corServico = coresDistintas(visiveis.map((s) => s.name), (n) => identidades.servicos[n]);
  const linhasServico = [
    ...visiveis.map((s) => ({ ...s, cor: corServico.get(s.name)!, outros: false })),
    ...(resto.length
      ? [{
          name: `Outros ${resto.length} serviços`,
          qty: resto.reduce((s, x) => s + x.qty, 0),
          total: resto.reduce((s, x) => s + x.total, 0),
          cor: "var(--muted-foreground)",
          outros: true,
        }]
      : []),
  ];
  const maxSvc = Math.max(...linhasServico.map((s) => s.total), 1);

  const pros = [...d.professionals].sort((a, b) => b.revenue - a.revenue);
  const corPro = coresDistintas(pros.map((p) => p.name), (n) => identidades.profissionais[n]?.cor);
  const totalPros = pros.reduce((s, p) => s + p.revenue, 0);
  const maxPro = Math.max(...pros.map((p) => p.revenue), 1);

  return (
    <div className="space-y-6">
      <Narrator lines={lines} alert={alert} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 min-w-0">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <Sparkle aria-hidden className="h-4.5 w-4.5 text-primary" /> Serviços mais vendidos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Receita de cada serviço no mês. A cor de cada um é sempre a mesma.</p>
          {linhasServico.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {linhasServico.map((s) => (
                <li key={s.name}>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1.5">
                    <span className={cn("min-w-0 truncate", s.outros && "text-muted-foreground")}>
                      {s.name} <span className="text-muted-foreground">· {s.qty}x</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="mr-2 text-xs text-muted-foreground">
                        {totalServicos > 0 ? pct((s.total / totalServicos) * 100) : "—"}
                      </span>
                      <span className="font-medium">{formatBRL(s.total)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(s.total / maxSvc) * 100}%`, backgroundColor: s.cor }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 min-w-0">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <Users aria-hidden className="h-4.5 w-4.5 text-primary" /> Desempenho por profissional
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Receita de cada uma no mês e a comissão que ela gerou.</p>
          {pros.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {pros.map((p) => {
                const id = identidades.profissionais[p.name];
                const cor = corPro.get(p.name) ?? null;
                return (
                  <li key={p.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar nome={p.name} cor={cor} foto={id?.foto} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(p.revenue)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(p.revenue / maxPro) * 100}%`, backgroundColor: cor ?? "var(--primary)" }} />
                      </div>
                      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground tabular-nums">
                        <span>
                          {p.qty} atendimento{p.qty === 1 ? "" : "s"}
                          {totalPros > 0 && <> · {pct((p.revenue / totalPros) * 100)} da receita</>}
                        </span>
                        <span>Comissão {formatBRL(p.commission)}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
