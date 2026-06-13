"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { formatBRL, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ChevronDown, Sparkles, Scissors, UserX, Loader2, X, Clock,
} from "lucide-react";

const STATUS: Record<string, { label: string; dot: string }> = {
  pending:     { label: "Aguardando",   dot: "#f59e0b" },
  confirmed:   { label: "Confirmado",   dot: "#10b981" },
  in_progress: { label: "Em andamento", dot: "#3b82f6" },
  completed:   { label: "Concluído",    dot: "#9ca3af" },
  cancelled:   { label: "Cancelado",    dot: "#ef4444" },
  no_show:     { label: "Faltou",       dot: "#e11d48" },
};

const PAYMENT_METHODS = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix",      label: "Pix"      },
  { id: "cartao",   label: "Cartão"   },
];

export type AgendaService = { name: string; price: number; duration: number };
export type AgendaItem = {
  id: string;
  starts_at: string;
  time: string;
  client: string;
  alert: string | null;
  prof: string;
  status: string;
  price: number;
  services: AgendaService[];
};

// ── Mini modal de finalização ──────────────────────────────────
function FinalizeModal({
  item, onClose, onDone,
}: {
  item: AgendaItem; onClose: () => void; onDone: (stockWarnings: string[]) => void;
}) {
  const supabase = createClient();
  const [method, setMethod] = useState("dinheiro");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [warn, setWarn]     = useState<string[] | null>(null);

  async function finalize() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("finalize_appointment" as never, {
      p_appointment: item.id,
      p_payment_method: method,
    } as never);
    if (error) {
      setErr("Não foi possível finalizar. Tente novamente.");
      setBusy(false);
      return;
    }
    const warnings = (data as { stock_warnings?: string[] } | null)?.stock_warnings ?? [];
    if (warnings.length > 0) { setWarn(warnings); setBusy(false); return; }
    onDone([]);
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-sm mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold">Finalizar atendimento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">{item.client} · {item.time}</p>

        {warn ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[var(--radius)] bg-amber-500/12 text-amber-700 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Atendimento finalizado. Estoque negativo:{" "}
                <b>{warn.join(", ")}</b>. Reponha quando puder.
              </div>
            </div>
            <Button className="w-full" onClick={() => onDone(warn)}>Entendi</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-[var(--radius)] bg-muted px-4 py-3 mt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl font-bold text-primary">{formatBRL(item.price)}</span>
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-1.5">Forma de pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id} type="button" onClick={() => setMethod(m.id)}
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
          </>
        )}
      </Card>
    </MotionModal>
  );
}

// ── Card de um agendamento ─────────────────────────────────────
function ItemCard({
  item, expanded, overdue, onToggle, onFinalize, onNoShow,
}: {
  item: AgendaItem;
  expanded: boolean;
  overdue: boolean;
  onToggle: () => void;
  onFinalize: () => void;
  onNoShow: () => void;
}) {
  const st = STATUS[item.status] ?? STATUS.pending;
  const isActionable = ["pending", "confirmed", "in_progress"].includes(item.status);

  return (
    <div className={cn(
      "rounded-[var(--radius)] border bg-card overflow-hidden",
      overdue ? "border-amber-500/40" : "border-border",
    )}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 sm:gap-4 p-4 text-left transition hover:bg-muted/40"
      >
        {/* Hora */}
        <div className="text-center shrink-0 w-12">
          <p className="font-display font-bold text-sm">{item.time}</p>
          {overdue && <p className="text-[10px] text-amber-600 font-medium leading-tight">atrasado</p>}
        </div>

        {/* Nome + profissional */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate flex items-center gap-2">
            {item.client}
            {item.alert && (
              <span
                title={item.alert}
                className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 px-2 py-0.5 text-[10px] font-medium shrink-0"
              >
                <AlertTriangle className="h-3 w-3" /> alerta
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {item.prof}
            {item.services.length > 0 && (
              <>{item.prof ? " · " : ""}{item.services.length} serviço{item.services.length === 1 ? "" : "s"}</>
            )}
          </p>
        </div>

        {/* Status badge */}
        <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-muted px-2.5 py-1 font-medium text-foreground/75 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
          <span className="hidden sm:inline">{st.label}</span>
        </span>

        <span className="font-semibold text-primary text-sm shrink-0">{formatBRL(item.price)}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
          {/* Serviços */}
          {item.services.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum serviço especificado.</p>
          ) : (
            <div className="space-y-1.5">
              {item.services.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-muted-foreground">{formatDuration(s.duration)}</span>
                    <span className="font-medium tabular-nums">{formatBRL(s.price)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Alerta de anamnese em detalhe */}
          {item.alert && (
            <div className="flex items-start gap-2 rounded-[var(--radius)] bg-red-500/10 border border-red-300/30 text-red-700 px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item.alert}
            </div>
          )}

          {/* Ações */}
          {isActionable && (
            <div className="flex gap-2 pt-0.5">
              <Button onClick={onFinalize} className="flex-1 h-9 text-sm gap-1.5">
                <Scissors className="h-3.5 w-3.5" /> Finalizar atendimento
              </Button>
              <button
                type="button"
                onClick={onNoShow}
                className="flex items-center gap-1.5 px-3 h-9 rounded-[var(--radius)] border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <UserX className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Faltou</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export function TodayAgenda({
  items: initialItems,
  salonId,
}: {
  items: AgendaItem[];
  salonId: string;
}) {
  const router   = useRouter();
  const supabase = createClient();
  const [items, setItems]       = useState(initialItems);
  const [open, setOpen]         = useState<Set<string>>(new Set());

  // Sync when server re-renders with fresh data (e.g. navigation back to dashboard)
  useEffect(() => { setItems(initialItems); }, [initialItems]);
  const [showPast, setShowPast] = useState(false);
  const [finalizing, setFinalizing] = useState<AgendaItem | null>(null);

  const { upcoming, pastPending } = useMemo(() => {
    const now = Date.now();
    // Futuros: hora ainda não passou OU em andamento
    const upcoming = items.filter(
      a =>
        (new Date(a.starts_at).getTime() >= now || a.status === "in_progress") &&
        !["completed", "cancelled", "no_show"].includes(a.status),
    );
    // Passados sem baixa: hora já passou E ainda abertos
    const pastPending = items.filter(
      a =>
        new Date(a.starts_at).getTime() < now &&
        ["pending", "confirmed"].includes(a.status),
    );
    return { upcoming, pastPending };
  }, [items]);

  const toggle = (id: string) =>
    setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function onNoShow(item: AgendaItem) {
    // Optimistic update
    setItems(list => list.map(x => x.id === item.id ? { ...x, status: "no_show" } : x));
    setOpen(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    await supabase.from("appointments").update({ status: "no_show" }).eq("id", item.id);
    router.refresh();
  }

  function onFinalizeSuccess(item: AgendaItem) {
    setFinalizing(null);
    setItems(list => list.map(x => x.id === item.id ? { ...x, status: "completed" } : x));
    setOpen(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    router.refresh();
  }

  const noPastMessage = upcoming.length === 0 && pastPending.length === 0;

  return (
    <div className="space-y-3">
      {/* ── Seção: próximos ───────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map(a => (
            <ItemCard
              key={a.id}
              item={a}
              expanded={open.has(a.id)}
              overdue={false}
              onToggle={() => toggle(a.id)}
              onFinalize={() => setFinalizing(a)}
              onNoShow={() => onNoShow(a)}
            />
          ))}
        </div>
      )}

      {upcoming.length === 0 && pastPending.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum agendamento pendente para hoje.
        </p>
      )}

      {upcoming.length === 0 && pastPending.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Sem próximos agendamentos no dia.
        </p>
      )}

      {/* ── Seção: aguardando baixa ───────────────────────── */}
      {pastPending.length > 0 && (
        <div className="rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPast(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-500/10 transition"
          >
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="flex-1 text-sm font-medium text-amber-700">
              {pastPending.length} agendamento{pastPending.length === 1 ? "" : "s"} aguardando baixa
            </span>
            <span className="text-[11px] text-amber-600 font-medium bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
              {pastPending.length}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-amber-600 shrink-0 transition-transform", showPast && "rotate-180")} />
          </button>

          {showPast && (
            <div className="border-t border-amber-500/20 p-3 space-y-2">
              {pastPending.map(a => (
                <ItemCard
                  key={a.id}
                  item={a}
                  expanded={open.has(a.id)}
                  overdue={true}
                  onToggle={() => toggle(a.id)}
                  onFinalize={() => setFinalizing(a)}
                  onNoShow={() => onNoShow(a)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de finalização ──────────────────────────── */}
      <AnimatePresence>
        {finalizing && (
          <FinalizeModal
            key="finalize"
            item={finalizing}
            onClose={() => setFinalizing(null)}
            onDone={() => onFinalizeSuccess(finalizing)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
