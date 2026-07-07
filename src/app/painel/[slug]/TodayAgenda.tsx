"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import Link from "next/link";
import { formatBRL, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import { getAnamnesisConfig, anamnesisToForm, HEALTH_CONDITIONS, type Niche } from "@/lib/anamnesis";
import {
  CaretDown,
  CircleNotch,
  Clock,
  Heart,
  Heartbeat,
  Scissors,
  ShieldCheck,
  Sparkle,
  UserMinus,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";

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
export type AgendaAnamnesis = Tables<"client_anamnesis">;
export type AgendaPhoto = { id: string; url: string; caption: string | null };
export type AgendaItem = {
  id: string;
  starts_at: string;
  time: string;
  client: string;
  clientId: string | null;
  photoUrl: string | null;
  alert: string | null;
  anamnesis: AgendaAnamnesis | null;
  inspiration: AgendaPhoto[];
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
              <Warning className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Atendimento finalizado. Estoque negativo:{" "}
                <b>{warn.join(", ")}</b>. Reponha quando puder.
              </div>
            </div>
            <Button className="w-full" onClick={() => onDone(warn)}>Entendi</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-[var(--radius)] bg-secondary border border-border px-4 py-3 mt-4">
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
                {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Confirmar e receber
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            </div>
          </>
        )}
      </Card>
    </MotionModal>
  );
}

// Avatar do cliente: foto (registro) ou inicial. Fallback neutro (bg-secondary).
function ClientAvatar({ name, photoUrl, size = 36 }: { name: string; photoUrl: string | null; size?: number }) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={name} className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="rounded-full grid place-items-center bg-secondary text-secondary-foreground font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Resumo compacto da ficha de anamnese — só o que importa pro atendimento.
// Condições críticas em vermelho, o resto em tom neutro (leitura em 1 segundo).
function AnamnesisSummary({
  anamnesis, niche, slug, clientId,
}: {
  anamnesis: AgendaAnamnesis;
  niche: Niche;
  slug: string;
  clientId: string | null;
}) {
  const cfg = getAnamnesisConfig(niche);
  const form = anamnesisToForm(anamnesis);
  const criticalKeys = new Set<string>(HEALTH_CONDITIONS.filter((c) => c.critical).map((c) => c.key));
  const marked = cfg.conditions.filter((c) => form[c.key]);
  const texts = cfg.textFields
    .map((f) => ({ label: f.label, value: form[f.key]?.trim() }))
    .filter((t) => !!t.value);

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Heartbeat className="h-3.5 w-3.5 text-primary" /> Ficha de anamnese
      </p>
      {marked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {marked.map((c) => {
            const crit = criticalKeys.has(c.key);
            return (
              <span
                key={c.key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  crit ? "bg-red-500/10 text-red-600" : "bg-muted text-foreground/75",
                )}
              >
                {crit && <Warning className="h-3 w-3" />} {c.label}
              </span>
            );
          })}
        </div>
      )}
      {texts.length > 0 && (
        <div className="space-y-1">
          {texts.map((t) => (
            <p key={t.label} className="text-xs">
              <span className="text-muted-foreground">{t.label}: </span>
              <span className={/alerg/i.test(t.label) ? "text-red-600 font-medium" : "text-foreground"}>{t.value}</span>
            </p>
          ))}
        </div>
      )}
      {marked.length === 0 && texts.length === 0 && (
        <p className="text-xs text-emerald-600 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Nenhuma restrição informada.
        </p>
      )}
      {clientId && (
        <Link
          href={`/painel/${slug}/clientes/${clientId}`}
          className="inline-block text-[11px] text-primary hover:underline"
        >
          Ver ficha completa
        </Link>
      )}
    </div>
  );
}

// ── Card de um agendamento ─────────────────────────────────────
function ItemCard({
  item, expanded, overdue, slug, niche, onToggle, onFinalize, onNoShow, onZoom,
}: {
  item: AgendaItem;
  expanded: boolean;
  overdue: boolean;
  slug: string;
  niche: Niche;
  onToggle: () => void;
  onFinalize: () => void;
  onNoShow: () => void;
  onZoom: (url: string) => void;
}) {
  const st = STATUS[item.status] ?? STATUS.pending;
  const isActionable = ["pending", "confirmed", "in_progress"].includes(item.status);
  const hasAnamnesis = !!item.anamnesis;

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

        {/* Avatar do cliente */}
        <ClientAvatar name={item.client} photoUrl={item.photoUrl} size={38} />

        {/* Nome + profissional + sinais (ficha/inspiração) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate min-w-0 flex-1">{item.client}</span>
            {/* Sinais compactos — sempre depois do nome, sem espremê-lo */}
            <span className="flex items-center gap-1 shrink-0">
              {item.alert ? (
                <span title={`Atenção — ${item.alert}`} className="grid place-items-center text-red-600">
                  <Warning className="h-4 w-4" weight="fill" />
                </span>
              ) : hasAnamnesis && (
                <span title="Ficha de anamnese preenchida" className="grid place-items-center text-primary">
                  <Heartbeat className="h-4 w-4" />
                </span>
              )}
              {item.inspiration.length > 0 && (
                <span title="Inspiração escolhida pela cliente" className="grid place-items-center text-primary">
                  <Heart className="h-3.5 w-3.5" weight="fill" />
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {item.prof}
            {item.services.length > 0 && (
              <>{item.prof ? " · " : ""}{item.services.length} serviço{item.services.length === 1 ? "" : "s"}</>
            )}
            {/* Preço na 2ª linha só no mobile (libera espaço pro nome no topo) */}
            <span className="sm:hidden"> · <span className="font-semibold text-primary">{formatBRL(item.price)}</span></span>
          </p>
        </div>

        {/* Status badge */}
        <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-muted px-2.5 py-1 font-medium text-foreground/75 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
          <span className="hidden sm:inline">{st.label}</span>
        </span>

        {/* Preço à direita só no desktop */}
        <span className="hidden sm:inline font-semibold text-primary text-sm shrink-0">{formatBRL(item.price)}</span>
        <CaretDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
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
                    <Sparkle className="h-3.5 w-3.5 text-primary shrink-0" />
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

          {/* Inspiração escolhida pela cliente (clique = zoom) */}
          {item.inspiration.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-primary" weight="fill" /> Inspiração da cliente
              </p>
              <div className="flex gap-2 flex-wrap">
                {item.inspiration.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onZoom(g.url)}
                    title={g.caption ?? "Ver foto"}
                    className="relative h-16 w-16 rounded-[var(--radius)] overflow-hidden border border-border hover:opacity-90 transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.caption ?? "Inspiração"} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alerta crítico em destaque */}
          {item.alert && (
            <div className="flex items-start gap-2 rounded-[var(--radius)] bg-red-500/10 border border-red-300/30 text-red-700 px-3 py-2 text-xs">
              <Warning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item.alert}
            </div>
          )}

          {/* Ficha de anamnese — resumo (só leitura) */}
          {item.anamnesis ? (
            <AnamnesisSummary anamnesis={item.anamnesis} niche={niche} slug={slug} clientId={item.clientId} />
          ) : item.clientId ? (
            <Link
              href={`/painel/${slug}/clientes/${item.clientId}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <Heartbeat className="h-3.5 w-3.5" /> Sem ficha de anamnese — preencher
            </Link>
          ) : null}

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
                <UserMinus className="h-3.5 w-3.5" />
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
  slug,
  niche,
}: {
  items: AgendaItem[];
  salonId: string;
  slug: string;
  niche: Niche;
}) {
  const router   = useRouter();
  const supabase = createClient();
  const [items, setItems]       = useState(initialItems);
  const [open, setOpen]         = useState<Set<string>>(new Set());

  // Sync when server re-renders with fresh data (e.g. navigation back to dashboard)
  useEffect(() => { setItems(initialItems); }, [initialItems]);
  const [showPast, setShowPast] = useState(false);
  const [finalizing, setFinalizing] = useState<AgendaItem | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

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
              slug={slug}
              niche={niche}
              onToggle={() => toggle(a.id)}
              onFinalize={() => setFinalizing(a)}
              onNoShow={() => onNoShow(a)}
              onZoom={setLightbox}
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
            <CaretDown className={cn("h-4 w-4 text-amber-600 shrink-0 transition-transform", showPast && "rotate-180")} />
          </button>

          {showPast && (
            <div className="border-t border-amber-500/20 p-3 space-y-2">
              {pastPending.map(a => (
                <ItemCard
                  key={a.id}
                  item={a}
                  expanded={open.has(a.id)}
                  overdue={true}
                  slug={slug}
                  niche={niche}
                  onToggle={() => toggle(a.id)}
                  onFinalize={() => setFinalizing(a)}
                  onNoShow={() => onNoShow(a)}
                  onZoom={setLightbox}
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

      {/* ── Lightbox da foto de inspiração ────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Inspiração" className="max-h-full max-w-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
