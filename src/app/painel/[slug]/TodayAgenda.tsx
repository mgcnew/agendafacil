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
  UserCheck,
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
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-display text-lg font-bold">Finalizar atendimento</h3>
          <button
            type="button" onClick={onClose} aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{item.client} · {item.time}</p>

        {warn ? (
          <div className="mt-4 space-y-4">
            <div role="status" className="rounded-[var(--radius)] bg-amber-500/12 text-amber-700 p-3 text-sm flex gap-2">
              <Warning aria-hidden className="h-4 w-4 shrink-0 mt-0.5" />
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
              <p id="forma-pgto" className="text-xs text-muted-foreground mb-1.5">Forma de pagamento</p>
              <div role="radiogroup" aria-labelledby="forma-pgto" className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id} type="button" onClick={() => setMethod(m.id)}
                    role="radio" aria-checked={method === m.id}
                    className={cn(
                      "rounded-[var(--radius)] border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
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
            {err && <p role="alert" className="text-sm text-red-600 mt-3">{err}</p>}
            <div className="flex gap-2 mt-5">
              <Button onClick={finalize} disabled={busy} className="flex-1">
                {busy && <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />}
                {busy ? "Registrando…" : "Confirmar e receber"}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
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
        <Heartbeat aria-hidden className="h-3.5 w-3.5 text-primary" /> Ficha de anamnese
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
                {crit && <Warning aria-hidden className="h-3 w-3" />} {c.label}
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
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Nenhuma restrição informada.
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
  item, expanded, overdue, slug, niche, busy, onToggle, onFinalize, onArrived, onNoShow, onZoom,
}: {
  item: AgendaItem;
  expanded: boolean;
  overdue: boolean;
  slug: string;
  niche: Niche;
  busy: boolean;
  onToggle: () => void;
  onFinalize: () => void;
  onArrived: () => void;
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
        className="w-full flex items-center gap-3 sm:gap-4 p-4 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
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
            {/* Sinais compactos — sempre depois do nome, sem espremê-lo.
                `title` sozinho não é lido por leitor de tela nem aparece no
                toque; o nome do sinal vai junto, escondido só visualmente. */}
            <span className="flex items-center gap-1 shrink-0">
              {item.alert ? (
                <span className="grid place-items-center text-red-600">
                  <Warning aria-hidden className="h-4 w-4" weight="fill" />
                  <span className="sr-only">Atenção — {item.alert}</span>
                </span>
              ) : hasAnamnesis && (
                <span className="grid place-items-center text-primary">
                  <Heartbeat aria-hidden className="h-4 w-4" />
                  <span className="sr-only">Ficha de anamnese preenchida</span>
                </span>
              )}
              {item.inspiration.length > 0 && (
                <span className="grid place-items-center text-primary">
                  <Heart aria-hidden className="h-3.5 w-3.5" weight="fill" />
                  <span className="sr-only">Inspiração escolhida pela cliente</span>
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

        {/* Status. No celular só cabia a bolinha — e cor sozinha não é
            informação: quem não distingue verde de âmbar, ou usa leitor de
            tela, ficava sem saber em que pé está o atendimento. */}
        <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-muted px-2.5 py-1 font-medium text-foreground/75 shrink-0">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
          <span className="hidden sm:inline">{st.label}</span>
          <span className="sr-only sm:hidden">{st.label}</span>
        </span>

        {/* Preço à direita só no desktop */}
        <span className="hidden sm:inline font-semibold text-primary text-sm shrink-0">{formatBRL(item.price)}</span>
        <CaretDown aria-hidden className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
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
                    <Sparkle aria-hidden className="h-3.5 w-3.5 text-primary shrink-0" />
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
                <Heart aria-hidden className="h-3.5 w-3.5 text-primary" weight="fill" /> Inspiração da cliente
              </p>
              <div className="flex gap-2 flex-wrap">
                {item.inspiration.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onZoom(g.url)}
                    aria-label={g.caption ? `Ampliar: ${g.caption}` : "Ampliar foto de inspiração"}
                    className="relative h-16 w-16 overflow-hidden rounded-[var(--radius)] border border-border transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
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
              <Warning aria-hidden className="h-3.5 w-3.5 shrink-0 mt-0.5" />
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
              <Heartbeat aria-hidden className="h-3.5 w-3.5" /> Sem ficha de anamnese — preencher
            </Link>
          ) : null}

          {/* Ações — na ordem em que o atendimento acontece.
              Antes de a cliente chegar, "Chegou" é a ação principal: é o único
              momento em que o sistema pode aprender que ela está no salão. Sem
              esse toque, um agendamento fica em "confirmado" para sempre e
              nada consegue distinguir quem foi atendida de quem sumiu — foi
              assim que 17 atendimentos ficaram parados no status.
              "Finalizar" continua ali para quem prefere dar a baixa de uma
              vez: marcar chegada não pode virar um toque obrigatório. */}
          {isActionable && (
            <div className="flex gap-2 pt-0.5">
              {item.status === "in_progress" ? (
                <Button onClick={onFinalize} disabled={busy} className="flex-1 h-9 text-sm gap-1.5">
                  <Scissors aria-hidden className="h-3.5 w-3.5" /> Finalizar atendimento
                </Button>
              ) : (
                <>
                  <Button onClick={onArrived} disabled={busy} className="flex-1 h-9 text-sm gap-1.5">
                    {busy
                      ? <CircleNotch aria-hidden className="h-3.5 w-3.5 animate-spin" />
                      : <UserCheck aria-hidden className="h-3.5 w-3.5" />}
                    Chegou
                  </Button>
                  <button
                    type="button"
                    onClick={onFinalize}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-[var(--radius)] border border-border text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                  >
                    <Scissors aria-hidden className="h-3.5 w-3.5" />
                    {/* No celular sobra só o ícone — o nome continua existindo
                        para quem não vê o desenho. */}
                    <span className="hidden sm:inline">Finalizar</span>
                    <span className="sr-only sm:hidden">Finalizar atendimento</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onNoShow}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 h-9 rounded-[var(--radius)] border border-border text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
              >
                <UserMinus aria-hidden className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Faltou</span>
                <span className="sr-only sm:hidden">Marcar que faltou</span>
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

  const [showPast, setShowPast] = useState(false);
  const [finalizing, setFinalizing] = useState<AgendaItem | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Sync when server re-renders with fresh data (e.g. navigation back to dashboard)
  useEffect(() => { setItems(initialItems); }, [initialItems]);

  // Esc fecha a foto ampliada. Sem isso quem navega por teclado ficava preso
  // na sobreposição preta até achar o X.
  useEffect(() => {
    if (!lightbox) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [lightbox]);

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

  /**
   * Troca de status com atualização otimista — e com volta atrás.
   *
   * Antes o `await` era solto: se o update falhasse (sem internet no salão,
   * permissão, sessão vencida), a tela seguia mostrando "Em andamento" ou
   * escondia o card como se a falta tivesse sido registrada. O `router.refresh`
   * até corrigia depois, mas sem uma palavra — e quem marcou já tinha seguido
   * para a próxima cliente acreditando que estava feito.
   */
  async function mudarStatus(
    item: AgendaItem,
    status: "in_progress" | "no_show",
    aviso: string,
  ) {
    const anterior = item.status;
    setBusyId(item.id);
    setErro(null);
    setItems(list => list.map(x => x.id === item.id ? { ...x, status } : x));
    const { error } = await supabase.from("appointments").update({ status }).eq("id", item.id);
    setBusyId(null);
    if (error) {
      setItems(list => list.map(x => x.id === item.id ? { ...x, status: anterior } : x));
      setErro(aviso);
      return;
    }
    if (status !== "in_progress") {
      setOpen(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
    router.refresh();
  }

  /**
   * "Chegou" → `in_progress`. É o único momento em que o sistema aprende que a
   * cliente está no salão, e é o que faz o sinal de atraso parar de apontá-la
   * (o filtro de atrasados só olha `pending`/`confirmed`).
   */
  const onArrived = (item: AgendaItem) =>
    mudarStatus(item, "in_progress", `Não deu para marcar a chegada de ${item.client}. Tente de novo.`);

  /**
   * "Faltou" pede confirmação porque some da tela: o card sai dos próximos e
   * some de "aguardando baixa" (que só olha pendente/confirmado). Errar o
   * toque aqui — e ele fica ao lado de "Chegou" — não tem desfazer nesta tela.
   */
  function onNoShow(item: AgendaItem) {
    if (!window.confirm(`Marcar que ${item.client} faltou ao horário das ${item.time}?`)) return;
    return mudarStatus(item, "no_show", `Não deu para registrar a falta de ${item.client}. Tente de novo.`);
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
      {/* A marcação voltou atrás — quem tocou precisa saber, senão sai daqui
          achando que registrou. */}
      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-[var(--radius)] border border-red-300/60 bg-red-500/10 px-3 py-2.5 text-sm text-red-700">
          <Warning aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{erro}</span>
          <button
            type="button" onClick={() => setErro(null)} aria-label="Dispensar aviso"
            className="shrink-0 rounded p-0.5 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

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
              busy={busyId === a.id}
              onToggle={() => toggle(a.id)}
              onFinalize={() => setFinalizing(a)}
              onArrived={() => onArrived(a)}
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
            aria-expanded={showPast}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600"
          >
            <Clock aria-hidden className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="flex-1 text-sm font-medium text-amber-700">
              {pastPending.length} agendamento{pastPending.length === 1 ? "" : "s"} aguardando baixa
            </span>
            <span className="text-[11px] text-amber-600 font-medium bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
              {pastPending.length}
            </span>
            <CaretDown aria-hidden className={cn("h-4 w-4 text-amber-600 shrink-0 transition-transform", showPast && "rotate-180")} />
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
                  busy={busyId === a.id}
                  onToggle={() => toggle(a.id)}
                  onFinalize={() => setFinalizing(a)}
                  onArrived={() => onArrived(a)}
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
          role="dialog"
          aria-modal="true"
          aria-label="Foto de inspiração"
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full p-2 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Fechar"
            autoFocus
          >
            <X aria-hidden className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Inspiração" className="max-h-full max-w-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
