"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/database.types";
import {
  Plus, Loader2, ChevronLeft, ChevronRight, X, AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
type View = "dia" | "semana" | "mes";
type Status = Enums<"appointment_status">;
type Pro     = { id: string; name: string; commission_percent: number; color: string | null };
type Service = { id: string; name: string; duration_min: number; price: number; commission_percent: number | null };
type Client  = { id: string; full_name: string; phone: string | null };
type Appt    = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: Status;
  total_price: number;
  member_id: string;
  clients: { full_name: string; alert_summary: string | null } | null;
  salon_members: { display_name: string | null } | null;
};

// ── Constants ──────────────────────────────────────────────────
// Cor do status = um ponto colorido; o texto usa token de tema (legível em
// qualquer um dos 12 temas, claro ou escuro). Mantém a semântica de cor.
const STATUS_META: Record<Status, { label: string; dot: string }> = {
  pending:     { label: "Aguardando",   dot: "#f59e0b" },
  confirmed:   { label: "Confirmado",   dot: "#10b981" },
  in_progress: { label: "Em andamento", dot: "#3b82f6" },
  completed:   { label: "Concluído",    dot: "#9ca3af" },
  cancelled:   { label: "Cancelado",    dot: "#ef4444" },
  no_show:     { label: "Faltou",       dot: "#e11d48" },
};

const STATUS_LIST = Object.entries(STATUS_META) as [Status, { label: string; dot: string }][];

// Paleta categórica para profissionais — evita âmbar/laranja/vermelho/verde,
// que colidem com a semântica dos status (aguardando/cancelado/confirmado).
const PALETTE = [
  "#6366f1","#ec4899","#8b5cf6","#3b82f6",
  "#14b8a6","#a855f7","#0ea5e9","#d946ef",
  "#06b6d4","#7c3aed",
];

const DAY_SHORT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const HOUR_START = 7;
const HOUR_END   = 21;
const CELL_H     = 64; // px per hour
const TOTAL_H    = (HOUR_END - HOUR_START) * CELL_H;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

// ── Date helpers ───────────────────────────────────────────────
const toStr   = (d: Date) => d.toISOString().slice(0, 10);
const parse   = (s: string) => new Date(s + "T12:00:00");
const isToday = (s: string) => s === toStr(new Date());

function addDays(s: string, n: number) {
  const d = parse(s); d.setDate(d.getDate() + n); return toStr(d);
}
function startOfWeek(s: string) {
  const d = parse(s);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return toStr(d);
}
function getWeekDays(s: string): string[] {
  const mon = startOfWeek(s);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}
function getMonthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const startOff = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const cursor = new Date(year, month, 1 - startOff);
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 7 }, () => { const s = toStr(cursor); cursor.setDate(cursor.getDate() + 1); return s; })
  );
}
function datePart(iso: string) { return new Date(iso).toISOString().slice(0, 10); }
function fmtHM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function inCurrentMonth(s: string, y: number, m: number) {
  const d = parse(s); return d.getFullYear() === y && d.getMonth() === m;
}

// ── Appointment layout helpers ─────────────────────────────────
function apptTop(a: Appt) {
  const d = new Date(a.starts_at);
  return Math.max(0, (d.getHours() + d.getMinutes() / 60 - HOUR_START) * CELL_H);
}
function apptH(a: Appt) {
  if (!a.ends_at) return CELL_H;
  const mins = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
  return Math.max(28, (mins / 60) * CELL_H);
}
function getColor(pros: Pro[], memberId: string) {
  const idx = pros.findIndex(p => p.id === memberId);
  return pros[idx]?.color ?? PALETTE[Math.max(0, idx) % PALETTE.length];
}

// ── Tooltip-style popover for appointment detail ───────────────
function ApptCard({ a, color, compact = false, onStatusChange }: {
  a: Appt; color: string; compact?: boolean; onStatusChange?: (s: Status) => void;
}) {
  const [open, setOpen] = useState(false);
  const st = STATUS_META[a.status];
  const h = apptH(a);

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label={`${a.clients?.full_name ?? "Cliente"} às ${fmtHM(a.starts_at)} — ${st.label}`}
        className="absolute inset-0 rounded-[6px] cursor-pointer overflow-hidden text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ borderLeft: `3px solid ${color}`, background: color + "1a" }}
      >
        <div className="px-2 py-1.5 h-full overflow-hidden">
          <p className="text-[11px] font-semibold truncate text-foreground/80">
            {fmtHM(a.starts_at)}{a.ends_at ? ` – ${fmtHM(a.ends_at)}` : ""}
          </p>
          {!compact && (
            <p className="text-[12px] font-medium text-foreground truncate leading-tight">
              {a.clients?.full_name ?? "Cliente"}
            </p>
          )}
          {h > 58 && !compact && (
            <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/75">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
              {st.label}
            </span>
          )}
        </div>
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="absolute left-full top-0 ml-2 z-50 w-60 rounded-[var(--radius)] bg-card border border-border shadow-xl p-3 space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{a.clients?.full_name ?? "Cliente"}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtHM(a.starts_at)}{a.ends_at ? ` – ${fmtHM(a.ends_at)}` : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {a.clients?.alert_summary && (
              <div className="flex items-start gap-1.5 rounded-md bg-red-500/10 text-red-600 px-2 py-1.5 text-[11px]">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {a.clients.alert_summary}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {a.salon_members?.display_name && <p>Prof.: {a.salon_members.display_name}</p>}
              <p className="font-semibold text-primary">{formatBRL(Number(a.total_price))}</p>
            </div>
            {onStatusChange && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: st.dot }} />
                <Select
                  value={a.status}
                  onChange={e => { onStatusChange(e.target.value as Status); setOpen(false); }}
                  className="w-full h-8 text-xs font-medium"
                >
                  {STATUS_LIST.map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </Select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Day View ───────────────────────────────────────────────────
const COL_W_DAY = 160; // min px per professional column

function DayView({ date, appts, pros, activePros, onStatusChange }: {
  date: string; appts: Appt[]; pros: Pro[]; activePros: Pro[];
  onStatusChange: (a: Appt, s: Status) => void;
}) {
  const cols = activePros.length > 0 ? activePros : pros;
  const now = new Date();
  const todayLine = isToday(date)
    ? ((now.getHours() + now.getMinutes() / 60 - HOUR_START) * CELL_H)
    : null;
  const nCols   = Math.max(1, cols.length);
  const minW    = 56 + nCols * COL_W_DAY;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card h-full flex flex-col overflow-hidden">
      {/* Single scroll container — syncs horizontal scroll across headers + grid */}
      <div className="flex-1 min-h-0 overflow-auto">

        {/* Sticky column headers */}
        <div className="flex sticky top-0 z-20 bg-card border-b border-border" style={{ minWidth: minW }}>
          {/* Corner */}
          <div className="w-14 shrink-0 sticky left-0 z-30 bg-card" />
          {cols.map((p) => {
            const color = getColor(pros, p.id);
            return (
              <div key={p.id}
                className="py-2.5 text-center border-l border-border"
                style={{ minWidth: COL_W_DAY, flex: 1 }}
              >
                <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />
                <span className="text-sm font-medium truncate">{p.name}</span>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex" style={{ minHeight: TOTAL_H, minWidth: minW }}>
          {/* Sticky time gutter */}
          <div className="w-14 shrink-0 sticky left-0 z-10 bg-card border-r border-border" style={{ height: TOTAL_H }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full" style={{ top: (h - HOUR_START) * CELL_H }}>
                <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground select-none">
                  {String(h).padStart(2,"0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Professional columns */}
          {cols.map((p) => {
            const color    = getColor(pros, p.id);
            const proAppts = appts.filter(a => a.member_id === p.id);
            return (
              <div key={p.id}
                className="relative border-l border-border"
                style={{ height: TOTAL_H, minWidth: COL_W_DAY, flex: 1 }}
              >
                {HOURS.map(h => (
                  <Fragment key={h}>
                    <div className="absolute w-full border-t border-border/40"
                      style={{ top: (h - HOUR_START) * CELL_H }} />
                    <div className="absolute w-full border-t border-dashed border-border/20"
                      style={{ top: (h - HOUR_START) * CELL_H + CELL_H / 2 }} />
                  </Fragment>
                ))}
                {todayLine !== null && todayLine >= 0 && todayLine <= TOTAL_H && (
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: todayLine }}>
                    <div className="absolute -left-1 top-[-4px] h-2 w-2 rounded-full bg-primary" />
                    <div className="border-t-2 border-primary w-full" />
                  </div>
                )}
                {proAppts.map(a => {
                  const top = apptTop(a);
                  const h   = apptH(a);
                  if (top < 0 || top >= TOTAL_H) return null;
                  return (
                    <div key={a.id} className="absolute left-1 right-1 z-10" style={{ top, height: h }}>
                      <ApptCard a={a} color={color} onStatusChange={s => onStatusChange(a, s)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Week View ──────────────────────────────────────────────────
const COL_W_WEEK = 90; // min px per day column

function WeekView({ date, appts, pros, activePros, onStatusChange, onDayClick }: {
  date: string; appts: Appt[]; pros: Pro[]; activePros: Pro[];
  onStatusChange: (a: Appt, s: Status) => void;
  onDayClick: (d: string) => void;
}) {
  const days     = getWeekDays(date);
  const now      = new Date();
  const todayStr = toStr(now);
  const minW     = 56 + 7 * COL_W_WEEK;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card h-full flex flex-col overflow-hidden">
      {/* Single scroll container */}
      <div className="flex-1 min-h-0 overflow-auto">

        {/* Sticky day headers */}
        <div className="flex sticky top-0 z-20 bg-card border-b border-border" style={{ minWidth: minW }}>
          {/* Corner */}
          <div className="w-14 shrink-0 sticky left-0 z-30 bg-card" />
          {days.map((day) => {
            const d     = parse(day);
            const today = isToday(day);
            return (
              <button
                key={day}
                onClick={() => onDayClick(day)}
                className="py-2 text-center border-l border-border hover:bg-muted/50 transition"
                style={{ minWidth: COL_W_WEEK, flex: 1 }}
              >
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {DAY_SHORT[d.getDay()]}
                </p>
                <span className={cn(
                  "inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold mt-0.5",
                  today ? "bg-primary text-primary-foreground" : "text-foreground",
                )}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex" style={{ minHeight: TOTAL_H, minWidth: minW }}>
          {/* Sticky time gutter */}
          <div className="w-14 shrink-0 sticky left-0 z-10 bg-card border-r border-border" style={{ height: TOTAL_H }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full" style={{ top: (h - HOUR_START) * CELL_H }}>
                <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground select-none">
                  {String(h).padStart(2,"0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const isT      = day === todayStr;
            const dayAppts = (activePros.length > 0
              ? appts.filter(a => activePros.some(p => p.id === a.member_id))
              : appts
            ).filter(a => datePart(a.starts_at) === day);
            const nowLine  = isT
              ? ((now.getHours() + now.getMinutes() / 60 - HOUR_START) * CELL_H)
              : null;

            return (
              <div key={day}
                className={cn("relative border-l border-border", isT && "bg-primary/[0.03]")}
                style={{ height: TOTAL_H, minWidth: COL_W_WEEK, flex: 1 }}
              >
                {HOURS.map(h => (
                  <Fragment key={h}>
                    <div className="absolute w-full border-t border-border/40"
                      style={{ top: (h - HOUR_START) * CELL_H }} />
                    <div className="absolute w-full border-t border-dashed border-border/20"
                      style={{ top: (h - HOUR_START) * CELL_H + CELL_H / 2 }} />
                  </Fragment>
                ))}
                {nowLine !== null && nowLine >= 0 && nowLine <= TOTAL_H && (
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: nowLine }}>
                    <div className="absolute -left-1 top-[-4px] h-2 w-2 rounded-full bg-primary" />
                    <div className="border-t-2 border-primary w-full" />
                  </div>
                )}
                {dayAppts.map(a => {
                  const color = getColor(pros, a.member_id);
                  const top   = apptTop(a);
                  const h     = apptH(a);
                  if (top < 0 || top >= TOTAL_H) return null;
                  return (
                    <div key={a.id} className="absolute left-0.5 right-0.5 z-10" style={{ top, height: h }}>
                      <ApptCard a={a} color={color} compact={h < 40}
                        onStatusChange={s => onStatusChange(a, s)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month View ─────────────────────────────────────────────────
function MonthView({ date, appts, pros, activePros, onDayClick, onNewAppt }: {
  date: string; appts: Appt[]; pros: Pro[]; activePros: Pro[];
  onDayClick: (d: string) => void;
  onNewAppt: (d: string) => void;
}) {
  const d     = parse(date);
  const year  = d.getFullYear();
  const month = d.getMonth();
  const grid  = getMonthGrid(year, month);
  const MAX   = 3;

  const filtered = activePros.length > 0
    ? appts.filter(a => activePros.some(p => p.id === a.member_id))
    : appts;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card overflow-hidden select-none">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_SHORT.map(n => (
          <div key={n} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {n}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            const dayAppts = filtered.filter(a => datePart(a.starts_at) === day);
            const overflow = Math.max(0, dayAppts.length - MAX);
            const inMonth  = inCurrentMonth(day, year, month);
            const today    = isToday(day);

            return (
              <div
                key={day}
                onClick={() => onDayClick(day)}
                className={cn(
                  "group relative min-h-[90px] p-1.5 border-b border-border cursor-pointer",
                  "hover:bg-muted/40 transition",
                  di < 6 && "border-r",
                  wi === 5 && "border-b-0",
                  !inMonth && "bg-muted/20",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "h-6 w-6 flex items-center justify-center rounded-full text-sm font-medium",
                    today
                      ? "bg-primary text-primary-foreground"
                      : inMonth ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {parse(day).getDate()}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onNewAppt(day); }}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {dayAppts.slice(0, MAX).map(a => {
                    const color = getColor(pros, a.member_id);
                    return (
                      <div
                        key={a.id}
                        onClick={e => e.stopPropagation()}
                        className="truncate text-[11px] font-medium px-1.5 py-0.5 rounded-[3px] text-foreground cursor-default"
                        style={{ background: color + "1f", borderLeft: `2px solid ${color}` }}
                        title={`${fmtHM(a.starts_at)} · ${a.clients?.full_name ?? "Cliente"} · ${a.salon_members?.display_name ?? ""}`}
                      >
                        {fmtHM(a.starts_at)} {a.clients?.full_name ?? "Cliente"}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-[11px] text-muted-foreground px-1.5">
                      +{overflow} mais
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export function AgendaManager({
  salonId, pros, services, clients: initialClients,
}: {
  salonId: string; pros: Pro[]; services: Service[]; clients: Client[];
}) {
  const supabase = createClient();
  const [view, setView]             = useState<View>("dia");
  const [date, setDate]             = useState(() => toStr(new Date()));
  const [selectedPros, setSelected] = useState<string[]>([]);
  const [appts, setAppts]           = useState<Appt[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [createDate, setCreateDate] = useState(date);
  const [finalizing, setFinalizing] = useState<Appt | null>(null);

  const activePros = useMemo(
    () => (selectedPros.length === 0 ? [] : pros.filter(p => selectedPros.includes(p.id))),
    [pros, selectedPros],
  );

  const load = useCallback(async () => {
    setLoading(true);
    let start: string, end: string;
    if (view === "dia") {
      start = new Date(date + "T00:00:00").toISOString();
      end   = new Date(date + "T23:59:59").toISOString();
    } else if (view === "semana") {
      const days = getWeekDays(date);
      start = new Date(days[0] + "T00:00:00").toISOString();
      end   = new Date(days[6] + "T23:59:59").toISOString();
    } else {
      const d = parse(date);
      start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    }
    const { data } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, total_price, member_id, clients(full_name, alert_summary), salon_members(display_name)")
      .eq("salon_id", salonId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at");
    setAppts((data as Appt[]) ?? []);
    setLoading(false);
  }, [supabase, salonId, date, view]);

  useEffect(() => { load(); }, [load]);

  async function onStatusChange(a: Appt, status: Status) {
    // Concluir abre o fluxo de finalização (forma de pagamento → caixa + comissão)
    if (status === "completed") {
      setFinalizing(a);
      return;
    }
    setAppts(list => list.map(x => x.id === a.id ? { ...x, status } : x));
    await supabase.from("appointments").update({ status }).eq("id", a.id);
  }

  function navigate(n: number) {
    if (view === "dia")    setDate(d => addDays(d, n));
    if (view === "semana") setDate(d => addDays(d, n * 7));
    if (view === "mes") {
      setDate(d => {
        const dt = parse(d); dt.setMonth(dt.getMonth() + n); return toStr(dt);
      });
    }
  }

  function togglePro(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const title = useMemo(() => {
    const d = parse(date);
    if (view === "dia") {
      const names = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
      return `${names[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
    }
    if (view === "semana") {
      const days = getWeekDays(date);
      const s = parse(days[0]), e = parse(days[6]);
      return s.getMonth() === e.getMonth()
        ? `${s.getDate()}–${e.getDate()} de ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`
        : `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0,3)} ${e.getFullYear()}`;
    }
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, [view, date]);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-56px)]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex rounded-[var(--radius)] border border-border overflow-hidden text-sm">
            {(["dia","semana","mes"] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 font-medium transition capitalize",
                  v === view
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted",
                )}
              >
                {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>

          {/* Nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 flex items-center justify-center rounded-[var(--radius)] border border-border hover:bg-muted transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDate(toStr(new Date()))}
              className="h-9 px-3 text-sm font-medium rounded-[var(--radius)] border border-border hover:bg-muted transition"
            >
              Hoje
            </button>
            <button
              onClick={() => navigate(1)}
              className="h-9 w-9 flex items-center justify-center rounded-[var(--radius)] border border-border hover:bg-muted transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => { setCreateDate(date); setCreating(true); }}>
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        </div>
      </div>

      {/* ── Professional filter ─────────────────────────────── */}
      {pros.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Profissional:</span>
          <button
            onClick={() => setSelected([])}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition font-medium",
              selectedPros.length === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-foreground/30 text-foreground",
            )}
          >
            Todas
          </button>
          {pros.map(p => {
            const color  = getColor(pros, p.id);
            const active = selectedPros.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePro(p.id)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition font-medium text-foreground",
                  active ? "" : "border-border hover:border-foreground/30",
                )}
                style={active ? { background: color + "22", borderColor: color } : {}}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Calendar body ────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === "mes" ? (
          <MonthView
            date={date} appts={appts} pros={pros} activePros={activePros}
            onDayClick={d => { setDate(d); setView("dia"); }}
            onNewAppt={d => { setCreateDate(d); setCreating(true); }}
          />
        ) : view === "semana" ? (
          <WeekView
            date={date} appts={appts} pros={pros} activePros={activePros}
            onStatusChange={onStatusChange}
            onDayClick={d => { setDate(d); setView("dia"); }}
          />
        ) : (
          <DayView
            date={date} appts={appts} pros={pros} activePros={activePros}
            onStatusChange={onStatusChange}
          />
        )}
      </div>

      {/* ── Create modal ──────────────────────────────────────── */}
      {creating && (
        <CreateAppointment
          salonId={salonId} pros={pros} services={services} clients={initialClients}
          date={createDate}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}

      {/* ── Finalizar atendimento ─────────────────────────────── */}
      {finalizing && (
        <FinalizeModal
          appt={finalizing}
          onClose={() => setFinalizing(null)}
          onDone={() => { setFinalizing(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Finalizar atendimento (forma de pagamento → caixa + comissão) ──
const PAYMENT_METHODS = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
];

function FinalizeModal({
  appt, onClose, onDone,
}: {
  appt: Appt; onClose: () => void; onDone: () => void;
}) {
  const supabase = createClient();
  const [method, setMethod] = useState("dinheiro");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function finalize() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("finalize_appointment", {
      p_appointment: appt.id,
      p_payment_method: method,
    });
    if (error) {
      setErr("Não foi possível finalizar. Tente novamente.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-sm p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold">Finalizar atendimento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          {appt.clients?.full_name ?? "Cliente"} · {fmtHM(appt.starts_at)}
        </p>

        <div className="flex items-center justify-between rounded-[var(--radius)] bg-muted px-4 py-3 mt-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-xl font-bold text-primary">{formatBRL(Number(appt.total_price))}</span>
        </div>

        <div className="mt-4">
          <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={cn(
                  "rounded-[var(--radius)] border px-3 py-2 text-sm font-medium transition",
                  method === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-foreground/25",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

        <div className="flex gap-2 mt-5">
          <Button onClick={finalize} disabled={busy} className="flex-1">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar e receber
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          A receita entra no caixa (se aberto) e a comissão é calculada automaticamente.
        </p>
      </Card>
    </div>
  );
}

// ── Create Appointment Modal ───────────────────────────────────
function CreateAppointment({
  salonId, pros, services, clients, date, onClose, onCreated,
}: {
  salonId: string; pros: Pro[]; services: Service[]; clients: Client[];
  date: string; onClose: () => void; onCreated: () => void;
}) {
  const supabase = createClient();
  const [clientName, setClientName]     = useState("");
  const [clientPhone, setClientPhone]   = useState("");
  const [existingClient, setExisting]   = useState("");
  const [proId, setProId]               = useState(pros[0]?.id ?? "");
  const [selected, setSelected]         = useState<string[]>([]);
  const [time, setTime]                 = useState("09:00");
  const [busy, setBusy]                 = useState(false);
  const [err, setErr]                   = useState<string | null>(null);

  const chosen     = services.filter(s => selected.includes(s.id));
  const totalPrice = chosen.reduce((a, s) => a + Number(s.price), 0);

  async function create() {
    setBusy(true); setErr(null);
    try {
      let clientId = existingClient || null;
      if (!clientId) {
        if (!clientName.trim()) { setErr("Informe o nome da cliente."); setBusy(false); return; }
        const { data: c, error: ce } = await supabase
          .from("clients")
          .insert({ salon_id: salonId, full_name: clientName.trim(), phone: clientPhone || null })
          .select("id").single();
        if (ce) throw ce;
        clientId = c.id;
      }
      const { error } = await supabase.rpc("create_staff_appointment", {
        p_salon: salonId, p_member: proId, p_client: clientId,
        p_service_ids: selected,
        p_starts_at: new Date(`${date}T${time}:00`).toISOString(),
      });
      if (error) {
        const m = error.message;
        setErr(
          m.includes("slot_taken")
            ? "A profissional já está ocupada nesse horário."
            : m.includes("client_busy")
              ? "Esta cliente já tem um atendimento nesse horário. Ative simultâneos nas Configurações para permitir."
              : "Não foi possível criar o agendamento.",
        );
        setBusy(false); return;
      }
      onCreated();
    } catch {
      setErr("Não foi possível criar o agendamento.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-lg max-h-[90vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold">Novo agendamento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={existingClient} onChange={e => setExisting(e.target.value)}>
              <option value="">+ Nova cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </div>
          {!existingClient && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} />
              <Input placeholder="Celular" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <Select value={proId} onChange={e => setProId(e.target.value)}>
              {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Serviços</Label>
            <div className="space-y-1.5 max-h-44 overflow-auto">
              {services.map(s => {
                const on = selected.includes(s.id);
                return (
                  <button
                    key={s.id} type="button"
                    onClick={() => setSelected(p => on ? p.filter(x => x !== s.id) : [...p, s.id])}
                    className={cn(
                      "w-full flex items-center justify-between rounded-[var(--radius)] border p-2.5 text-sm transition",
                      on ? "border-primary bg-secondary/40" : "border-border hover:border-foreground/20",
                    )}
                  >
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{formatBRL(Number(s.price))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="h-11 flex items-center font-semibold text-primary">{formatBRL(totalPrice)}</div>
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button className="w-full" onClick={create} disabled={busy || selected.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar agendamento
          </Button>
        </div>
      </Card>
    </div>
  );
}
