"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { Calendar } from "@/components/Calendar";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/database.types";
import { HEALTH_CONDITIONS } from "@/lib/anamnesis";
import {
  Plus, Loader2, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, X,
  AlertTriangle, CalendarOff, Phone, ExternalLink, Scissors, MessageCircle, Lock,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
type View = "dia" | "semana" | "mes";
type Status = Enums<"appointment_status">;
type Pro     = { id: string; name: string; commission_percent: number; color: string | null; photo_url?: string | null };
type Service = { id: string; name: string; duration_min: number; price: number; commission_percent: number | null; color?: string | null };

const NO_SERVICE_COLOR = "#94a3b8"; // cinza neutro para serviço sem cor
type Client  = { id: string; full_name: string; phone: string | null };
type Appt    = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: Status;
  total_price: number;
  member_id: string;
  client_id: string | null;
  notes: string | null;
  clients: { full_name: string; phone: string | null; alert_summary: string | null } | null;
  salon_members: { display_name: string | null } | null;
  appointment_services?: { service_id: string | null }[] | null;
  color?: string;
};
type ApptService = { id: string; name: string; price: number; duration_min: number };
type Block = { id: string; member_id: string | null; starts_at: string; ends_at: string; reason: string | null };
type HistoryAppt = {
  id: string;
  starts_at: string;
  status: string;
  total_price: number;
  salon_members: { display_name: string | null } | null;
  appointment_services: { name: string }[];
};
type ClientAnamnesis = {
  [key: string]: unknown;
  is_pregnant: boolean;
  is_breastfeeding: boolean;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_heart_condition: boolean;
  has_coagulation_issue: boolean;
  has_epilepsy: boolean;
  has_cancer_treatment: boolean;
  has_thyroid: boolean;
  allergies: string | null;
  medications: string | null;
  recent_procedures: string | null;
  skin_hair_notes: string | null;
  general_notes: string | null;
};

// ── Constants ──────────────────────────────────────────────────
const STATUS_META: Record<Status, { label: string; dot: string }> = {
  pending:     { label: "Aguardando",   dot: "#f59e0b" },
  confirmed:   { label: "Confirmado",   dot: "#10b981" },
  in_progress: { label: "Em andamento", dot: "#3b82f6" },
  completed:   { label: "Concluído",    dot: "#9ca3af" },
  cancelled:   { label: "Cancelado",    dot: "#ef4444" },
  no_show:     { label: "Faltou",       dot: "#e11d48" },
};

const STATUS_LIST = Object.entries(STATUS_META) as [Status, { label: string; dot: string }][];

const PALETTE = [
  "#6366f1","#ec4899","#8b5cf6","#3b82f6",
  "#14b8a6","#a855f7","#0ea5e9","#d946ef",
  "#06b6d4","#7c3aed",
];

const DAY_SHORT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAY_LONG   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const DEFAULT_START = 7;
const DEFAULT_END   = 21;
const CELL_H        = 64;

type Bounds = { start: number; end: number };

function hourBounds(items: { starts_at: string; ends_at: string | null }[]): Bounds {
  let start = DEFAULT_START;
  let end   = DEFAULT_END;
  for (const a of items) {
    const s = new Date(a.starts_at);
    const e = a.ends_at ? new Date(a.ends_at) : s;
    start = Math.min(start, s.getHours());
    end   = Math.max(end, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
  }
  return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
}

function hoursOf(b: Bounds) {
  return Array.from({ length: b.end - b.start }, (_, i) => b.start + i);
}
const totalHeight = (b: Bounds) => (b.end - b.start) * CELL_H;

// ── Date helpers ───────────────────────────────────────────────
const toStr   = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
function datePart(iso: string) { return toStr(new Date(iso)); }
function fmtHM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}
/** Normaliza telefone BR para o formato do wa.me (55 + DDD + número, só dígitos). */
function waPhone(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}
/** Converte posição Y (px) dentro da grade em horário "HH:mm", arredondando a 30 min. */
function yToTime(y: number, hourStart: number) {
  const totalMin = (y / CELL_H + hourStart) * 60;
  const rounded = Math.round(totalMin / 30) * 30;
  const clamped = Math.max(0, Math.min(23 * 60 + 30, rounded));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
function inCurrentMonth(s: string, y: number, m: number) {
  const d = parse(s); return d.getFullYear() === y && d.getMonth() === m;
}

// ── Appointment layout helpers ─────────────────────────────────
function apptTop(a: Appt, hourStart: number) {
  const d = new Date(a.starts_at);
  return Math.max(0, (d.getHours() + d.getMinutes() / 60 - hourStart) * CELL_H);
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

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Avatar do profissional: foto, ou iniciais sobre a cor do profissional. */
function ProAvatar({ pro, size = 24 }: { pro: Pro; size?: number }) {
  if (pro.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pro.photo_url} alt={pro.name} className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="rounded-full grid place-items-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: pro.color ?? PALETTE[0], fontSize: Math.round(size * 0.4) }}>
      {initials(pro.name)}
    </span>
  );
}

// ── Bloqueios de horário (almoço, intervalo, compromisso) ──────
function rangeTop(startIso: string, hourStart: number) {
  const d = new Date(startIso);
  return Math.max(0, (d.getHours() + d.getMinutes() / 60 - hourStart) * CELL_H);
}
function rangeH(startIso: string, endIso: string) {
  const mins = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  return Math.max(16, (mins / 60) * CELL_H);
}
/** Bloqueios que se aplicam a uma coluna de profissional num dia. */
function blocksFor(blocks: Block[], memberId: string | null, day: string) {
  return blocks.filter(
    b => datePart(b.starts_at) === day && (b.member_id === null || b.member_id === memberId),
  );
}

const BLOCK_STRIPES =
  "repeating-linear-gradient(45deg, rgba(100,116,139,0.16), rgba(100,116,139,0.16) 6px, rgba(100,116,139,0.06) 6px, rgba(100,116,139,0.06) 12px)";

function BlockCard({ b, canManage, onDelete }: {
  b: Block; canManage: boolean; onDelete: (b: Block) => void;
}) {
  return (
    <button
      type="button"
      onClick={canManage ? (e) => { e.stopPropagation(); onDelete(b); } : undefined}
      title={canManage ? "Clique para remover o bloqueio" : (b.reason ?? "Horário bloqueado")}
      className={cn(
        "absolute inset-0 rounded-[6px] overflow-hidden text-left border border-slate-300/60",
        canManage ? "cursor-pointer" : "cursor-default",
      )}
      style={{ background: BLOCK_STRIPES }}
    >
      <div className="px-2 py-1 h-full flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
          <Lock className="h-2.5 w-2.5 shrink-0" /> Bloqueado
        </span>
        {b.reason && <span className="text-[11px] text-slate-600/90 truncate leading-tight">{b.reason}</span>}
      </div>
    </button>
  );
}

// ── Appointment card (grid block, opens detail modal on click) ─
function ApptCard({ a, color, compact = false, onOpen }: {
  a: Appt; color: string; compact?: boolean; onOpen: () => void;
}) {
  const st = STATUS_META[a.status];
  const h = apptH(a);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${a.clients?.full_name ?? "Cliente"} às ${fmtHM(a.starts_at)} — ${st.label}`}
      className="absolute inset-0 rounded-[6px] cursor-pointer overflow-hidden text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      style={{ borderLeft: `3px solid ${color}`, background: color + "1a" }}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-start gap-0.5 overflow-hidden">
        {compact ? (
          /* Card compacto (< 44px): horário + nome na mesma linha */
          <p className="text-[11px] font-medium truncate leading-tight text-foreground/90">
            <span className="font-semibold">{fmtHM(a.starts_at)}</span>
            {" · "}{a.clients?.full_name ?? "Cliente"}
          </p>
        ) : (
          <>
            <p className="text-[11px] font-semibold truncate text-foreground/80 leading-tight">
              {fmtHM(a.starts_at)}{a.ends_at ? ` – ${fmtHM(a.ends_at)}` : ""}
            </p>
            <p className="text-[12px] font-medium text-foreground truncate leading-tight">
              {a.clients?.full_name ?? "Cliente"}
            </p>
          </>
        )}
        {h > 58 && !compact && (
          <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/75">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
            {st.label}
          </span>
        )}
        {a.clients?.alert_summary && (
          <AlertTriangle className="h-2.5 w-2.5 text-red-500 mt-0.5 shrink-0" aria-label="Restrição" />
        )}
      </div>
    </button>
  );
}

// ── Appointment detail modal ───────────────────────────────────
function ApptDetailModal({
  appt, color, salonId, slug, onClose, onStatusChange, onFinalize,
}: {
  appt: Appt; color: string; salonId: string; slug: string;
  onClose: () => void;
  onStatusChange: (s: Status) => void;
  onFinalize: () => void;
}) {
  const supabase = createClient();
  const st = STATUS_META[appt.status];

  const [services, setServices]       = useState<ApptService[] | null>(null);
  const [history, setHistory]         = useState<HistoryAppt[] | null>(null);
  const [anamnesis, setAnamnesis]     = useState<ClientAnamnesis | null | "empty">(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnam, setShowAnam]       = useState(false);

  // Fetch services on mount
  useEffect(() => {
    supabase
      .from("appointment_services")
      .select("id, name, price, duration_min")
      .eq("appointment_id", appt.id)
      .then(({ data }) => setServices((data as ApptService[]) ?? []));
  }, [appt.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch history when expanded
  useEffect(() => {
    if (!showHistory || !appt.client_id || history !== null) return;
    supabase
      .from("appointments")
      .select("id, starts_at, status, total_price, salon_members(display_name), appointment_services(name)")
      .eq("salon_id", salonId)
      .eq("client_id", appt.client_id)
      .neq("id", appt.id)
      .order("starts_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory((data as unknown as HistoryAppt[]) ?? []));
  }, [showHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch anamnesis when expanded
  useEffect(() => {
    if (!showAnam || !appt.client_id || anamnesis !== null) return;
    supabase
      .from("client_anamnesis")
      .select("*")
      .eq("client_id", appt.client_id)
      .maybeSingle()
      .then(({ data }) => setAnamnesis(data ? (data as unknown as ClientAnamnesis) : "empty"));
  }, [showAnam]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientInitial = (appt.clients?.full_name ?? "?").charAt(0).toUpperCase();
  const isFinished    = appt.status === "completed" || appt.status === "cancelled" || appt.status === "no_show";
  const phone         = waPhone(appt.clients?.phone);

  /** Abre o WhatsApp do cliente com a confirmação do horário pronta. */
  function remindWhatsApp() {
    const first = (appt.clients?.full_name ?? "").split(" ")[0];
    const svcNames = (services ?? []).map((s) => s.name).join(", ");
    const msg =
      `Oi${first ? ` ${first}` : ""}! Passando para confirmar seu horário ` +
      `${fmtDate(appt.starts_at)} às ${fmtHM(appt.starts_at)}` +
      `${svcNames ? ` — ${svcNames}` : ""}. Está confirmado? 💇`;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <MotionModal onClose={onClose}>
      <div className="w-full sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-[var(--radius)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <h3 className="font-display text-lg font-bold">Agendamento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── Cliente ─────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center h-11 w-11 rounded-full text-white font-display text-lg font-bold shrink-0"
              style={{ background: color }}
            >
              {clientInitial}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{appt.clients?.full_name ?? "Cliente"}</p>
              {appt.clients?.phone && (
                <a
                  href={`tel:${appt.clients.phone}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-3 w-3" /> {appt.clients.phone}
                </a>
              )}
            </div>
            {appt.client_id && (
              <Link
                href={`/painel/${slug}/clientes/${appt.client_id}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                onClick={onClose}
              >
                Ver ficha <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* ── Alerta de anamnese ──────────────────────────── */}
          {appt.clients?.alert_summary && (
            <div className="flex items-start gap-2 rounded-[var(--radius)] bg-red-500/10 border border-red-300/40 text-red-700 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold mb-0.5">Atenção — restrições</p>
                <p className="text-xs">{appt.clients.alert_summary}</p>
              </div>
            </div>
          )}

          {/* ── Data / horário / profissional ───────────────── */}
          <div className="rounded-[var(--radius)] bg-secondary border border-border px-3.5 py-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Data</span>
              <span className="font-medium">
                {fmtDate(appt.starts_at)}
                {" · "}{fmtHM(appt.starts_at)}{appt.ends_at ? ` – ${fmtHM(appt.ends_at)}` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Profissional</span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                {appt.salon_members?.display_name ?? "—"}
              </span>
            </div>
            {appt.notes && (
              <div className="flex items-start justify-between gap-2 pt-0.5 border-t border-border/60 mt-1">
                <span className="text-muted-foreground text-xs shrink-0 mt-0.5">Obs.</span>
                <span className="text-xs text-right">{appt.notes}</span>
              </div>
            )}
          </div>

          {/* ── Serviços ────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Serviços</p>
            {services === null ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
              </div>
            ) : services.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sem serviços registrados.</p>
            ) : (
              <div className="rounded-[var(--radius)] bg-secondary border border-border px-3.5 py-3 space-y-1.5">
                {services.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="flex-1 min-w-0 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground mx-2 shrink-0">{s.duration_min} min</span>
                    <span className="font-medium shrink-0">{formatBRL(Number(s.price))}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="font-display font-bold text-primary">{formatBRL(Number(appt.total_price))}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Status e ações ──────────────────────────────── */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex items-center gap-2.5 rounded-[var(--radius)] bg-secondary border border-border px-3 h-9">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: st.dot }} />
              <Select
                value={appt.status}
                onValueChange={(v) => onStatusChange(v as Status)}
                className="flex-1 bg-transparent border-0 h-full text-xs font-medium shadow-none outline-none"
              >
                {STATUS_LIST.map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </Select>
            </div>

            {!isFinished && (
              <div className="grid grid-cols-1 gap-2">
                {appt.clients?.phone && (
                  <Button variant="outline" onClick={remindWhatsApp} className="w-full">
                    <MessageCircle className="h-4 w-4" /> Lembrar pelo WhatsApp
                  </Button>
                )}
                <Button onClick={onFinalize} className="w-full">
                  <Scissors className="h-4 w-4" /> Finalizar atendimento
                </Button>
              </div>
            )}
          </div>

          {/* ── Histórico da cliente ────────────────────────── */}
          {appt.client_id && (
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between text-sm font-medium hover:text-foreground/80"
              >
                <span>Histórico da cliente</span>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showHistory && "rotate-90")} />
              </button>

              {showHistory && (
                <div className="mt-3 space-y-1.5">
                  {history === null ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem atendimentos anteriores.</p>
                  ) : (
                    history.map(h => {
                      const hst = STATUS_META[h.status as Status] ?? { dot: "#9ca3af", label: h.status };
                      const names = (h.appointment_services ?? []).map(s => s.name).join(", ");
                      return (
                        <div key={h.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5" style={{ background: hst.dot }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{fmtDate(h.starts_at)} · {fmtHM(h.starts_at)}</p>
                            {names && <p className="text-muted-foreground truncate">{names}</p>}
                            {h.salon_members?.display_name && (
                              <p className="text-muted-foreground">{h.salon_members.display_name}</p>
                            )}
                          </div>
                          <span className="font-medium shrink-0">{formatBRL(Number(h.total_price))}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Anamnese ────────────────────────────────────── */}
          {appt.client_id && (
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowAnam(v => !v)}
                className="w-full flex items-center justify-between text-sm font-medium hover:text-foreground/80"
              >
                <span>Anamnese</span>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showAnam && "rotate-90")} />
              </button>

              {showAnam && (
                <div className="mt-3 space-y-3">
                  {anamnesis === null ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
                    </div>
                  ) : anamnesis === "empty" ? (
                    <p className="text-xs text-muted-foreground">Anamnese não preenchida.</p>
                  ) : (
                    <>
                      {/* Condições de saúde */}
                      <div className="flex flex-wrap gap-1.5">
                        {HEALTH_CONDITIONS.map(c => {
                          const active = !!anamnesis[c.key as keyof ClientAnamnesis];
                          if (!active) return null;
                          return (
                            <span
                              key={c.key}
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                                c.critical
                                  ? "bg-red-500/10 text-red-700 border border-red-300/40"
                                  : "bg-amber-500/10 text-amber-700 border border-amber-300/40",
                              )}
                            >
                              {c.critical && <AlertTriangle className="h-2.5 w-2.5" />}
                              {c.label}
                            </span>
                          );
                        })}
                        {!HEALTH_CONDITIONS.some(c => !!anamnesis[c.key as keyof ClientAnamnesis]) && (
                          <span className="text-xs text-muted-foreground">Sem condições registradas.</span>
                        )}
                      </div>

                      {/* Campos de texto */}
                      {[
                        { label: "Alergias", value: anamnesis.allergies },
                        { label: "Medicamentos", value: anamnesis.medications },
                        { label: "Procedimentos recentes", value: anamnesis.recent_procedures },
                        { label: "Cabelo / pele", value: anamnesis.skin_hair_notes },
                        { label: "Observações gerais", value: anamnesis.general_notes },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label}>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">{f.label}</p>
                          <p className="text-xs">{f.value}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MotionModal>
  );
}

// ── Day View ───────────────────────────────────────────────────
const COL_W_DAY = 160;

function DayView({ date, appts, blocks, pros, activePros, canManageSchedule, myMemberId, onApptClick, onSlotClick, onDeleteBlock }: {
  date: string; appts: Appt[]; blocks: Block[]; pros: Pro[]; activePros: Pro[];
  canManageSchedule: boolean; myMemberId?: string;
  onApptClick: (a: Appt) => void;
  onSlotClick: (date: string, proId: string, time: string) => void;
  onDeleteBlock: (b: Block) => void;
}) {
  const canDelBlock = (b: Block) => canManageSchedule || (!!myMemberId && b.member_id === myMemberId);
  const cols = activePros.length > 0 ? activePros : pros;
  const bounds  = hourBounds([...appts, ...blocks]);
  const hours   = hoursOf(bounds);
  const totalH  = totalHeight(bounds);
  const now = new Date();
  const todayLine = isToday(date)
    ? ((now.getHours() + now.getMinutes() / 60 - bounds.start) * CELL_H)
    : null;
  const nCols   = Math.max(1, cols.length);
  const minW    = 56 + nCols * COL_W_DAY;
  const isEmpty = appts.length === 0;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto scroll-thin relative">
        {/* Sticky column headers */}
        <div className="flex sticky top-0 z-20 bg-card border-b border-border" style={{ minWidth: minW }}>
          <div className="w-14 shrink-0 sticky left-0 z-30 bg-card" />
          {cols.map((p) => (
            <div key={p.id}
              className="py-2 px-1 flex items-center justify-center gap-1.5 border-l border-border"
              style={{ minWidth: COL_W_DAY, flex: 1 }}
            >
              <ProAvatar pro={p} size={24} />
              <span className="text-sm font-medium truncate">{p.name}</span>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex" style={{ minHeight: totalH, minWidth: minW }}>
          <div className="w-14 shrink-0 sticky left-0 z-10 bg-card border-r border-border" style={{ height: totalH }}>
            {hours.map(h => (
              <div key={h} className="absolute w-full" style={{ top: (h - bounds.start) * CELL_H }}>
                <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground select-none">
                  {String(h).padStart(2,"0")}:00
                </span>
              </div>
            ))}
          </div>

          {cols.map((p) => {
            const proAppts = appts.filter(a => a.member_id === p.id);
            return (
              <div key={p.id}
                className="relative border-l border-border cursor-pointer"
                style={{ height: totalH, minWidth: COL_W_DAY, flex: 1 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onSlotClick(date, p.id, yToTime(e.clientY - rect.top, bounds.start));
                }}
                title="Clique para agendar neste horário"
              >
                {hours.map(h => (
                  <Fragment key={h}>
                    <div className="absolute w-full border-t border-border/40"
                      style={{ top: (h - bounds.start) * CELL_H }} />
                    <div className="absolute w-full border-t border-dashed border-border/20"
                      style={{ top: (h - bounds.start) * CELL_H + CELL_H / 2 }} />
                  </Fragment>
                ))}
                {todayLine !== null && todayLine >= 0 && todayLine <= totalH && (
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: todayLine }}>
                    <div className="absolute -left-1 top-[-4px] h-2 w-2 rounded-full bg-primary" />
                    <div className="border-t-2 border-primary w-full" />
                  </div>
                )}
                {blocksFor(blocks, p.id, date).map(b => (
                  <div key={b.id} className="absolute left-1 right-1 z-[5]"
                    style={{ top: rangeTop(b.starts_at, bounds.start), height: rangeH(b.starts_at, b.ends_at) }}>
                    <BlockCard b={b} canManage={canDelBlock(b)} onDelete={onDeleteBlock} />
                  </div>
                ))}
                {proAppts.map(a => {
                  const top = apptTop(a, bounds.start);
                  const h   = apptH(a);
                  return (
                    <div key={a.id} className="absolute left-1 right-1 z-10" style={{ top, height: h }}
                      onClick={(e) => e.stopPropagation()}>
                      <ApptCard a={a} color={a.color ?? NO_SERVICE_COLOR} compact={h < 44} onOpen={() => onApptClick(a)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {isEmpty && <EmptyDay />}
      </div>
    </div>
  );
}

// ── Mobile: lista cronológica do dia (mais confortável que a grade) ──
function AgendaList({ date, appts, blocks, pros, activePros, canManageSchedule, myMemberId, onApptClick, onNewAppt, onDeleteBlock }: {
  date: string; appts: Appt[]; blocks: Block[]; pros: Pro[]; activePros: Pro[];
  canManageSchedule: boolean; myMemberId?: string;
  onApptClick: (a: Appt) => void;
  onNewAppt: (date: string) => void;
  onDeleteBlock: (b: Block) => void;
}) {
  const canDelBlock = (b: Block) => canManageSchedule || (!!myMemberId && b.member_id === myMemberId);
  const visible = (activePros.length > 0
    ? appts.filter(a => activePros.some(p => p.id === a.member_id))
    : appts
  ).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const visibleBlocks = (activePros.length > 0
    ? blocks.filter(b => b.member_id === null || activePros.some(p => p.id === b.member_id))
    : blocks
  ).filter(b => datePart(b.starts_at) === date);

  // Mescla atendimentos e bloqueios em ordem cronológica.
  const rows = [
    ...visible.map(a => ({ kind: "appt" as const, at: a.starts_at, appt: a })),
    ...visibleBlocks.map(b => ({ kind: "block" as const, at: b.starts_at, block: b })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto scroll-thin">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <CalendarOff className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">Nenhum agendamento</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => onNewAppt(date)}>
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(row => {
              if (row.kind === "block") {
                const b = row.block;
                const canDel = canDelBlock(b);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={canDel ? () => onDeleteBlock(b) : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-3 text-left",
                        canDel && "hover:bg-muted/50 transition",
                      )}
                    >
                      <div className="shrink-0 text-center w-14">
                        <p className="text-sm font-semibold leading-tight">{fmtHM(b.starts_at)}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtHM(b.ends_at)}</p>
                      </div>
                      <span className="h-9 w-1 rounded-full shrink-0 bg-slate-300" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1 text-slate-600">
                          <Lock className="h-3.5 w-3.5 shrink-0" /> Horário bloqueado
                        </p>
                        {b.reason && <p className="text-xs text-muted-foreground truncate">{b.reason}</p>}
                      </div>
                    </button>
                  </li>
                );
              }
              const a = row.appt;
              const color = a.color ?? getColor(pros, a.member_id);
              const st = STATUS_META[a.status];
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onApptClick(a)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/50 transition"
                  >
                    {/* Faixa de horário */}
                    <div className="shrink-0 text-center w-14">
                      <p className="text-sm font-semibold leading-tight">{fmtHM(a.starts_at)}</p>
                      {a.ends_at && <p className="text-[11px] text-muted-foreground">{fmtHM(a.ends_at)}</p>}
                    </div>
                    {/* Barra colorida do profissional */}
                    <span className="h-9 w-1 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {a.clients?.alert_summary && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        {a.clients?.full_name ?? "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.salon_members?.display_name ?? "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatBRL(Number(a.total_price))}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="pointer-events-none absolute inset-0 top-12 flex flex-col items-center justify-center text-center px-6">
      <CalendarOff className="h-8 w-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-muted-foreground">Nenhum agendamento</p>
      <p className="text-xs text-muted-foreground/70">Clique em "Novo agendamento" para começar.</p>
    </div>
  );
}

// ── Week View ──────────────────────────────────────────────────
const COL_W_WEEK = 90;

function WeekView({ date, appts, blocks, pros, activePros, canManageSchedule, myMemberId, onApptClick, onDayClick, onSlotClick, onDeleteBlock }: {
  date: string; appts: Appt[]; blocks: Block[]; pros: Pro[]; activePros: Pro[];
  canManageSchedule: boolean; myMemberId?: string;
  onApptClick: (a: Appt) => void;
  onDayClick: (d: string) => void;
  onSlotClick: (date: string, time: string) => void;
  onDeleteBlock: (b: Block) => void;
}) {
  const canDelBlock = (b: Block) => canManageSchedule || (!!myMemberId && b.member_id === myMemberId);
  const days     = getWeekDays(date);
  const now      = new Date();
  const todayStr = toStr(now);
  const minW     = 56 + 7 * COL_W_WEEK;
  const visible  = activePros.length > 0
    ? appts.filter(a => activePros.some(p => p.id === a.member_id))
    : appts;
  const visibleBlocks = activePros.length > 0
    ? blocks.filter(b => b.member_id === null || activePros.some(p => p.id === b.member_id))
    : blocks;
  const bounds   = hourBounds([...visible, ...visibleBlocks]);
  const hours    = hoursOf(bounds);
  const totalH   = totalHeight(bounds);
  const isEmpty  = visible.length === 0;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto scroll-thin relative">
        {/* Sticky day headers */}
        <div className="flex sticky top-0 z-20 bg-card border-b border-border" style={{ minWidth: minW }}>
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
        <div className="flex" style={{ minHeight: totalH, minWidth: minW }}>
          <div className="w-14 shrink-0 sticky left-0 z-10 bg-card border-r border-border" style={{ height: totalH }}>
            {hours.map(h => (
              <div key={h} className="absolute w-full" style={{ top: (h - bounds.start) * CELL_H }}>
                <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground select-none">
                  {String(h).padStart(2,"0")}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const isT      = day === todayStr;
            const dayAppts = visible.filter(a => datePart(a.starts_at) === day);
            const nowLine  = isT
              ? ((now.getHours() + now.getMinutes() / 60 - bounds.start) * CELL_H)
              : null;

            return (
              <div key={day}
                className={cn("relative border-l border-border cursor-pointer", isT && "bg-primary/[0.03]")}
                style={{ height: totalH, minWidth: COL_W_WEEK, flex: 1 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onSlotClick(day, yToTime(e.clientY - rect.top, bounds.start));
                }}
                title="Clique para agendar neste horário"
              >
                {hours.map(h => (
                  <Fragment key={h}>
                    <div className="absolute w-full border-t border-border/40"
                      style={{ top: (h - bounds.start) * CELL_H }} />
                    <div className="absolute w-full border-t border-dashed border-border/20"
                      style={{ top: (h - bounds.start) * CELL_H + CELL_H / 2 }} />
                  </Fragment>
                ))}
                {nowLine !== null && nowLine >= 0 && nowLine <= totalH && (
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: nowLine }}>
                    <div className="absolute -left-1 top-[-4px] h-2 w-2 rounded-full bg-primary" />
                    <div className="border-t-2 border-primary w-full" />
                  </div>
                )}
                {visibleBlocks.filter(b => datePart(b.starts_at) === day).map(b => (
                  <div key={b.id} className="absolute left-0.5 right-0.5 z-[5]"
                    style={{ top: rangeTop(b.starts_at, bounds.start), height: rangeH(b.starts_at, b.ends_at) }}>
                    <BlockCard b={b} canManage={canDelBlock(b)} onDelete={onDeleteBlock} />
                  </div>
                ))}
                {dayAppts.map(a => {
                  const color = a.color ?? getColor(pros, a.member_id);
                  const top   = apptTop(a, bounds.start);
                  const h     = apptH(a);
                  return (
                    <div key={a.id} className="absolute left-0.5 right-0.5 z-10" style={{ top, height: h }}
                      onClick={(e) => e.stopPropagation()}>
                      <ApptCard a={a} color={color} compact={h < 40}
                        onOpen={() => onApptClick(a)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {isEmpty && <EmptyDay />}
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
                    const color = a.color ?? getColor(pros, a.member_id);
                    return (
                      <div
                        key={a.id}
                        className="w-full truncate text-left text-[11px] font-medium px-1.5 py-0.5 rounded-[3px] text-foreground pointer-events-none"
                        style={{ background: color + "1f", borderLeft: `2px solid ${color}` }}
                      >
                        {a.clients?.alert_summary && (
                          <AlertTriangle className="inline h-2.5 w-2.5 text-red-500 mr-0.5 -mt-0.5" />
                        )}
                        {fmtHM(a.starts_at)} {a.clients?.full_name ?? "Cliente"}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-[11px] text-muted-foreground px-1.5 pointer-events-none">
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
  salonId, slug, pros, services, clients: initialClients, discounts = {},
  canManageSchedule = false, myMemberId,
}: {
  salonId: string; slug: string; pros: Pro[]; services: Service[]; clients: Client[];
  discounts?: Record<string, number>;
  canManageSchedule?: boolean;
  myMemberId?: string;
}) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView]             = useState<View>("dia");
  const [date, setDate]             = useState(() => toStr(new Date()));
  const [selectedPros, setSelected] = useState<string[]>([]);
  const [appts, setAppts]           = useState<Appt[]>([]);
  const [blocks, setBlocks]         = useState<Block[]>([]);
  const [loading, setLoading]       = useState(true);
  const [blocking, setBlocking]     = useState(false);
  const [creating, setCreating]     = useState(false);
  const [createDate, setCreateDate] = useState(date);
  const [createPro, setCreatePro]   = useState<string | undefined>(undefined);
  const [createTime, setCreateTime] = useState<string | undefined>(undefined);
  const [createClientId, setCreateClientId] = useState<string | undefined>(undefined);
  const [detailAppt, setDetailAppt] = useState<Appt | null>(null);
  const [finalizing, setFinalizing] = useState<Appt | null>(null);

  /** Abre o modal de criação, opcionalmente já com profissional, horário e cliente. */
  const openCreate = useCallback((d: string, pro?: string, time?: string, clientId?: string) => {
    setCreateDate(d);
    setCreatePro(pro);
    setCreateTime(time);
    setCreateClientId(clientId);
    setCreating(true);
  }, []);

  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current) return;
    if (searchParams.get("novo") === "1") {
      openedFromUrl.current = true;
      openCreate(toStr(new Date()), undefined, undefined, searchParams.get("cliente") ?? undefined);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname, openCreate]);

  const activePros = useMemo(
    () => (selectedPros.length === 0 ? [] : pros.filter(p => selectedPros.includes(p.id))),
    [pros, selectedPros],
  );

  // Cor de cada serviço, para colorir os eventos por serviço.
  const serviceColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of services) if (s.color) m[s.id] = s.color;
    return m;
  }, [services]);

  // Cor do evento = cor do 1º serviço do atendimento (cinza neutro se sem cor).
  const apptColor = useCallback((a: Appt): string => {
    const sid = a.appointment_services?.find((x) => x.service_id && serviceColor[x.service_id])?.service_id;
    return (sid && serviceColor[sid]) || NO_SERVICE_COLOR;
  }, [serviceColor]);

  // Sou um profissional com coluna na agenda? (posso bloquear meu próprio horário)
  const iAmPro = !!myMemberId && pros.some(p => p.id === myMemberId);
  const canBlock = canManageSchedule || iAmPro;

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
    const [{ data }, { data: blockData }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, total_price, member_id, client_id, notes, clients(full_name, phone, alert_summary), salon_members(display_name), appointment_services(service_id)")
        .eq("salon_id", salonId)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .order("starts_at"),
      supabase
        .from("schedule_blocks")
        .select("id, member_id, starts_at, ends_at, reason")
        .eq("salon_id", salonId)
        .lte("starts_at", end)
        .gte("ends_at", start),
    ]);
    setAppts(((data as Appt[]) ?? []).map((a) => ({ ...a, color: apptColor(a) })));
    setBlocks((blockData as Block[]) ?? []);
    setLoading(false);
  }, [supabase, salonId, date, view, apptColor]);

  useEffect(() => { load(); }, [load]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const channel = supabase
      .channel(`agenda:${salonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
        () => loadRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_blocks", filter: `salon_id=eq.${salonId}` },
        () => loadRef.current(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, salonId]);

  async function onStatusChange(a: Appt, status: Status) {
    if (status === "completed") {
      setDetailAppt(null);
      setFinalizing(a);
      return;
    }
    const prev = a.status;
    // Optimistic update
    setAppts(list => list.map(x => x.id === a.id ? { ...x, status } : x));
    if (detailAppt?.id === a.id) setDetailAppt(d => d ? { ...d, status } : d);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) {
      setAppts(list => list.map(x => x.id === a.id ? { ...x, status: prev } : x));
      if (detailAppt?.id === a.id) setDetailAppt(d => d ? { ...d, status: prev } : d);
    }
  }

  async function deleteBlock(b: Block) {
    if (!confirm("Remover este bloqueio? O horário volta a ficar disponível.")) return;
    const prev = blocks;
    setBlocks(list => list.filter(x => x.id !== b.id));
    const { error } = await supabase.from("schedule_blocks").delete().eq("id", b.id);
    if (error) setBlocks(prev);
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
      return `${DAY_LONG[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
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

  const detailColor = detailAppt ? (detailAppt.color ?? getColor(pros, detailAppt.member_id)) : "#6366f1";

  return (
    <div className="flex flex-col gap-3 h-full af-rise">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          {canBlock && (
            <Button variant="outline" onClick={() => setBlocking(true)}>
              <Lock className="h-4 w-4" /> Bloquear
            </Button>
          )}
          <Button onClick={() => openCreate(date)}>
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        </div>
      </div>

      {/* ── Professional filter ─────────────────────────── */}
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

      {/* ── Calendar body ────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === "mes" ? (
          <MonthView
            date={date} appts={appts} pros={pros} activePros={activePros}
            onDayClick={d => { setDate(d); setView("dia"); }}
            onNewAppt={d => openCreate(d)}
          />
        ) : view === "semana" ? (
          <WeekView
            date={date} appts={appts} blocks={blocks} pros={pros} activePros={activePros}
            canManageSchedule={canManageSchedule} myMemberId={myMemberId}
            onApptClick={a => setDetailAppt(a)}
            onDayClick={d => { setDate(d); setView("dia"); }}
            onSlotClick={(d, time) => openCreate(d, undefined, time)}
            onDeleteBlock={deleteBlock}
          />
        ) : (
          <>
            {/* Mobile: lista cronológica · Desktop: grade por profissional */}
            <div className="sm:hidden h-full">
              <AgendaList
                date={date} appts={appts} blocks={blocks} pros={pros} activePros={activePros}
                canManageSchedule={canManageSchedule} myMemberId={myMemberId}
                onApptClick={a => setDetailAppt(a)}
                onNewAppt={d => openCreate(d)}
                onDeleteBlock={deleteBlock}
              />
            </div>
            <div className="hidden sm:block h-full">
              <DayView
                date={date} appts={appts} blocks={blocks} pros={pros} activePros={activePros}
                canManageSchedule={canManageSchedule} myMemberId={myMemberId}
                onApptClick={a => setDetailAppt(a)}
                onSlotClick={(d, proId, time) => openCreate(d, proId, time)}
                onDeleteBlock={deleteBlock}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Appointment detail modal ──────────────────────── */}
      <AnimatePresence>
        {detailAppt && (
          <ApptDetailModal
            key="detail"
            appt={detailAppt}
            color={detailColor}
            salonId={salonId}
            slug={slug}
            onClose={() => setDetailAppt(null)}
            onStatusChange={s => onStatusChange(detailAppt, s)}
            onFinalize={() => { setDetailAppt(null); setFinalizing(detailAppt); }}
          />
        )}
      </AnimatePresence>

      {/* ── Create modal ──────────────────────────────────── */}
      <AnimatePresence>
        {creating && (
          <CreateAppointment
            key="create"
            salonId={salonId} pros={pros} services={services} clients={initialClients}
            discounts={discounts}
            date={createDate}
            initialPro={createPro}
            initialTime={createTime}
            initialClient={createClientId}
            onClose={() => setCreating(false)}
            onCreated={() => { setCreating(false); load(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Bloquear horário ──────────────────────────────── */}
      <AnimatePresence>
        {blocking && (
          <BlockModal
            key="block"
            salonId={salonId}
            pros={pros}
            date={date}
            selfOnly={!canManageSchedule}
            myMemberId={myMemberId}
            onClose={() => setBlocking(false)}
            onCreated={() => { setBlocking(false); load(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Finalizar atendimento ─────────────────────────── */}
      <AnimatePresence>
        {finalizing && (
          <FinalizeModal
            key="finalize"
            appt={finalizing}
            onClose={() => setFinalizing(null)}
            onDone={() => { setFinalizing(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Finalizar atendimento ──────────────────────────────────────
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
  const [warn, setWarn]     = useState<string[] | null>(null);

  async function finalize() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("finalize_appointment", {
      p_appointment: appt.id,
      p_payment_method: method,
    });
    if (error) {
      setErr("Não foi possível finalizar. Tente novamente.");
      setBusy(false);
      return;
    }
    const warnings = (data as { stock_warnings?: string[] } | null)?.stock_warnings ?? [];
    if (warnings.length > 0) {
      setWarn(warnings);
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-sm mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold">Finalizar atendimento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          {appt.clients?.full_name ?? "Cliente"} · {fmtHM(appt.starts_at)}
        </p>

        {warn ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[var(--radius)] bg-amber-500/12 text-amber-700 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Atendimento finalizado. O estoque ficou negativo de:{" "}
                <b>{warn.join(", ")}</b>. Reponha quando puder.
              </div>
            </div>
            <Button className="w-full" onClick={onDone}>Entendi</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-[var(--radius)] bg-secondary border border-border px-4 py-3 mt-4">
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
              A receita entra no caixa (se aberto), comissão e baixa de estoque automáticas.
            </p>
          </>
        )}
      </Card>
    </MotionModal>
  );
}

// ── Bloquear horário ───────────────────────────────────────────
function BlockModal({
  salonId, pros, date: initialDate, selfOnly = false, myMemberId, onClose, onCreated,
}: {
  salonId: string; pros: Pro[]; date: string;
  selfOnly?: boolean; myMemberId?: string;
  onClose: () => void; onCreated: () => void;
}) {
  const supabase = createClient();
  // selfOnly: profissional só pode bloquear a própria agenda.
  const [memberId, setMemberId] = useState<string>(selfOnly ? (myMemberId ?? "") : ""); // "" = todos
  const myName = pros.find(p => p.id === myMemberId)?.name ?? "Você";
  const [date, setDate]         = useState(initialDate);
  const [startT, setStartT]     = useState("12:00");
  const [endT, setEndT]         = useState("13:00");
  const [reason, setReason]     = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function save() {
    const startsAt = new Date(`${date}T${startT}:00`);
    const endsAt   = new Date(`${date}T${endT}:00`);
    if (!(endsAt > startsAt)) { setErr("O fim precisa ser depois do início."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from("schedule_blocks").insert({
      salon_id: salonId,
      member_id: memberId || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(
        error.message.includes("permission") || error.code === "42501"
          ? "Você não tem permissão para bloquear horários."
          : "Não foi possível bloquear. Tente novamente.",
      );
      return;
    }
    onCreated();
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-sm mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Bloquear horário
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          Almoço, intervalo, compromisso… O horário some da agenda online.
        </p>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label>Profissional</Label>
            {selfOnly ? (
              <div className="h-11 flex items-center rounded-[var(--radius)] border border-border bg-secondary/40 px-3.5 text-sm text-muted-foreground">
                {myName} · seu horário
              </div>
            ) : (
              <Select value={memberId} onValueChange={setMemberId}>
                <option value="">Todos (salão inteiro)</option>
                {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={startT} onChange={e => setStartT(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={endT} onChange={e => setEndT(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: Almoço, médico, reunião" />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Bloquear
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </MotionModal>
  );
}

// ── Create Appointment Modal ───────────────────────────────────
function CreateAppointment({
  salonId, pros, services, clients, discounts, date: initialDate, initialPro, initialTime, initialClient, onClose, onCreated,
}: {
  salonId: string; pros: Pro[]; services: Service[]; clients: Client[];
  discounts: Record<string, number>;
  date: string; initialPro?: string; initialTime?: string; initialClient?: string;
  onClose: () => void; onCreated: () => void;
}) {
  const supabase = createClient();
  const [clientName, setClientName]     = useState("");
  const [clientPhone, setClientPhone]   = useState("");
  // Pré-seleciona o cliente se ele já existir na lista (ex.: veio da ficha).
  const [existingClient, setExisting]   = useState(
    initialClient && clients.some(c => c.id === initialClient) ? initialClient : "",
  );
  const [proId, setProId]               = useState(initialPro ?? pros[0]?.id ?? "");
  // Aplica o horário clicado na grade só uma vez, assim que os slots carregam.
  const initialTimeUsed = useRef(false);
  const [selected, setSelected]         = useState<string[]>([]);
  const [date, setDate]                 = useState(initialDate);
  const [showCal, setShowCal]           = useState(false);
  const [slot, setSlot]                 = useState<string>("");
  const [slots, setSlots]               = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [err, setErr]                   = useState<string | null>(null);
  const [svcSearch, setSvcSearch]       = useState("");
  const [lastSvcs, setLastSvcs]         = useState<{ id: string; name: string }[] | null>(null);

  const dateLabel = (() => {
    const d = parse(date);
    return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
  })();

  const discOf     = (s: Service) => discounts[s.id] ?? 0;
  const effOf      = (s: Service) => {
    const d = discOf(s);
    return d > 0 ? Math.round(Number(s.price) * (1 - d / 100) * 100) / 100 : Number(s.price);
  };
  const chosen     = services.filter(s => selected.includes(s.id));
  const totalPrice = chosen.reduce((a, s) => a + effOf(s), 0);
  const totalDuration = chosen.reduce((a, s) => a + s.duration_min, 0);

  // Último serviço do cliente selecionado
  useEffect(() => {
    if (!existingClient) { setLastSvcs(null); return; }
    supabase
      .from("appointments")
      .select("id, appointment_services(service_id, services(id, name))")
      .eq("client_id", existingClient)
      .eq("salon_id", salonId)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setLastSvcs(null); return; }
        type AptSvc = { service_id: string; services: { id: string; name: string } | null };
        const svcs = (data.appointment_services as AptSvc[])
          .filter(r => r.services)
          .map(r => ({ id: r.services!.id, name: r.services!.name }));
        setLastSvcs(svcs.length ? svcs : null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingClient, salonId]);

  useEffect(() => {
    if (!proId || totalDuration <= 0) { setSlots([]); setSlot(""); return; }
    let cancelled = false;
    setLoadingSlots(true);
    supabase
      .rpc("get_availability", { p_salon: salonId, p_member: proId, p_date: date, p_duration: totalDuration })
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data as string[]) ?? [];
        setSlots(list);
        setSlot(cur => {
          if (list.includes(cur)) return cur;
          // primeira carga: tenta casar com o horário clicado na grade
          if (!initialTimeUsed.current && initialTime) {
            initialTimeUsed.current = true;
            const match = list.find(s => slotLabel(s) === initialTime);
            if (match) return match;
          }
          return "";
        });
        setLoadingSlots(false);
      });
    return () => { cancelled = true; };
  }, [supabase, salonId, proId, date, totalDuration]);

  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  async function create() {
    if (!slot) { setErr("Escolha um horário disponível."); return; }
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
        p_starts_at: slot,
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

  const filteredServices = svcSearch.trim()
    ? services.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase()))
    : services;

  const serviceButtons = filteredServices.map(s => {
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
        <span className="flex items-center gap-1.5">
          {s.name}
          {discOf(s) > 0 && (
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">-{discOf(s)}%</span>
          )}
        </span>
        {discOf(s) > 0 ? (
          <span>
            <span className="text-muted-foreground line-through mr-1.5">{formatBRL(Number(s.price))}</span>
            <span className="text-foreground">{formatBRL(effOf(s))}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{formatBRL(Number(s.price))}</span>
        )}
      </button>
    );
  });

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-auto sm:overflow-hidden p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold">Novo agendamento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {/* Desktop: two columns. Mobile: single column */}
        <div className="sm:flex sm:gap-6 sm:min-h-[440px]">

          {/* Left column — fields */}
          <div className="space-y-4 sm:w-60 sm:shrink-0 sm:flex sm:flex-col sm:space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={existingClient} onValueChange={v => { setExisting(v); setSelected([]); }}>
                <option value="">+ Nova cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </Select>
            </div>
            {!existingClient && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} />
                <Input placeholder="Celular" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
              </div>
            )}
            {lastSvcs && (
              <div className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground truncate">
                  Último: <span className="text-foreground font-medium">{lastSvcs.map(s => s.name).join(", ")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(lastSvcs.map(s => s.id).filter(id => services.some(sv => sv.id === id)))}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  Usar
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={proId} onValueChange={setProId}>
                {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>

            {/* Serviços — mobile only */}
            <div className="space-y-1.5 sm:hidden">
              <Label>Serviços</Label>
              <Input
                placeholder="Buscar serviço…"
                value={svcSearch}
                onChange={e => setSvcSearch(e.target.value)}
              />
              <div className="space-y-1.5 max-h-44 overflow-auto">{serviceButtons}</div>
            </div>

            {/* Data — mobile: toggle; desktop: calendário fixo */}
            <div className="space-y-1.5">
              <Label>Data</Label>
              <button
                type="button"
                onClick={() => setShowCal(v => !v)}
                aria-expanded={showCal}
                className="sm:hidden h-11 w-full flex items-center justify-between rounded-[var(--radius)] border border-border bg-card px-3.5 text-sm text-foreground hover:border-foreground/25 transition"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  {dateLabel}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showCal && "rotate-180")} />
              </button>
              {showCal && (
                <Calendar value={date} onChange={(d) => { setDate(d); setShowCal(false); }} className="mt-1 sm:hidden" />
              )}
              <Calendar value={date} onChange={(d) => setDate(d)} className="hidden sm:block" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Select
                  value={slot}
                  onValueChange={setSlot}
                  disabled={loadingSlots || slots.length === 0}
                  placeholder={
                    totalDuration <= 0 ? "Escolha serviços"
                      : loadingSlots ? "Carregando…"
                        : slots.length === 0 ? "Sem horários" : "Selecione"
                  }
                >
                  {slots.map(s => <option key={s} value={s}>{slotLabel(s)}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <div className="h-11 flex items-center font-semibold text-primary">{formatBRL(totalPrice)}</div>
              </div>
            </div>

            {proId && totalDuration > 0 && !loadingSlots && slots.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum horário livre nesta data para esta profissional. Verifique os horários de trabalho em Configurações.
              </p>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button className="w-full sm:mt-auto" onClick={create} disabled={busy || selected.length === 0 || !slot}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar agendamento
            </Button>
          </div>

          {/* Right column — services (desktop only) */}
          <div className="hidden sm:flex sm:flex-col sm:flex-1 sm:min-w-0">
            <Label className="mb-2">Serviços</Label>
            <Input
              placeholder="Buscar serviço…"
              value={svcSearch}
              onChange={e => setSvcSearch(e.target.value)}
              className="mb-2"
            />
            <div className="flex-1 overflow-auto space-y-1.5 pr-0.5">{serviceButtons}</div>
          </div>

        </div>
      </Card>
    </MotionModal>
  );
}
