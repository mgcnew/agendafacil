import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  UserCheck,
  Cake,
  Package,
  Stack,
  Wallet,
  Sparkle,
  CaretRight,
  ChatCircle,
  CalendarX,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import {
  getOrGenerateDashboardInsights,
  type Insight,
  type InsightType,
} from "@/lib/ai/dashboardInsights";
import { collectSignals } from "@/lib/signals/collect";
import { getDismissedKeys, signalKeyForInsight } from "@/lib/signals/dismissals";
import { RefreshGestorButton } from "./RefreshGestorButton";
import { TypewriterText } from "./TypewriterText";
import { InsightsCarousel } from "./InsightsCarousel";
import { DismissibleCard } from "./DismissibleCard";

export type BirthdayContact = { id: string; name: string; phone: string | null };

/** Link de WhatsApp com parabéns pronto — clique do dono autoriza o envio. */
function birthdayWaUrl(c: BirthdayContact): string | null {
  const digits = (c.phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  const first = c.name.split(" ")[0];
  const msg = `🎉 Feliz aniversário, ${first}! Desejamos um dia incrível 💛`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

const ICON: Record<InsightType, React.ComponentType<{ className?: string }>> = {
  reactivation: UserCheck,
  birthday: Cake,
  package_expiring: Package,
  package_dormant: Package,
  revenue: Wallet,
  low_stock: Stack,
  service_dormant: CalendarX,
  product_dormant: CalendarX,
  recent_no_shows: XCircle,
  general: Sparkle,
};

const PRIORITY_STYLE: Record<Insight["priority"], string> = {
  alta: "bg-amber-500/12 text-amber-600",
  media: "bg-secondary text-primary",
  baixa: "bg-muted text-muted-foreground",
};

// Fundo/borda sutil por prioridade — só um leve toque de cor pra hierarquia,
// sem poluir. Alta puxa âmbar (urgência); média um sussurro do primário;
// baixa fica neutra.
const CARD_STYLE: Record<Insight["priority"], string> = {
  alta: "border-amber-500/25 bg-amber-500/[0.055] hover:border-amber-500/40",
  media: "border-primary/15 bg-primary/[0.035] hover:border-primary/40",
  baixa: "border-border bg-background hover:border-primary/40",
};

// Cor do ícone acompanha a prioridade, mantendo tudo coeso.
const ICON_ACCENT: Record<Insight["priority"], string> = {
  alta: "text-amber-600",
  media: "text-primary",
  baixa: "text-muted-foreground",
};

function hrefFor(slug: string, type: InsightType): string | null {
  switch (type) {
    case "reactivation":
      return `/painel/${slug}/recuperar`;
    case "package_expiring":
    case "package_dormant":
      return `/painel/${slug}/pacotes`;
    case "revenue":
      return `/painel/${slug}/financeiro`;
    case "low_stock":
    case "product_dormant":
      return `/painel/${slug}/estoque`;
    case "service_dormant":
      return `/painel/${slug}/servicos`;
    case "recent_no_shows":
      return `/painel/${slug}/recuperar`;
    default:
      return null;
  }
}

/** Placeholder exibido enquanto o resumo (1ª visita do dia) ainda está sendo gerado. */
export function GestorInsightsSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-36 rounded bg-muted" />
          <div className="h-3 w-52 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="h-16 rounded-[var(--radius)] bg-muted/60" />
        <div className="h-16 rounded-[var(--radius)] bg-muted/60" />
      </div>
    </div>
  );
}

/**
 * Server Component assíncrono — só ele fica atrás do Suspense. Assim a
 * chamada ao DeepSeek (1ª visita do dia, sem cache) nunca bloqueia o resto
 * do Dashboard: o resto da página renderiza na hora e esse card "entra"
 * depois, via streaming.
 */
export async function GestorInsightsAsync({
  slug,
  supabase,
  salonId,
  firstName,
  salonName,
}: {
  slug: string;
  supabase: SupabaseClient;
  salonId: string;
  firstName: string;
  salonName: string;
}) {
  // Todo o trabalho de sinais (queries + IA) mora atrás do Suspense: coletamos
  // os avisos da mesma fonte única usada pelas páginas e só então narramos.
  const { context, signals, birthdays } = await collectSignals(supabase, salonId, { firstName, salonName });
  const result = await getOrGenerateDashboardInsights(supabase, salonId, context, signals);

  // Remove o que o dono dispensou hoje — mesmo que já esteja no cache do dia,
  // o card sai da tela (o cache regenera sem ele na próxima análise/amanhã).
  const dismissed = await getDismissedKeys(supabase, salonId);
  const insights = dismissed.size > 0
    ? result.insights.filter((it) => {
        const k = signalKeyForInsight(it.type);
        return !k || !dismissed.has(k);
      })
    : result.insights;

  const birthdayClients: BirthdayContact[] = birthdays
    .filter((b) => b.days_until === 0)
    .map((b) => ({ id: b.id, name: b.name, phone: b.phone }));
  return <GestorInsightsCard slug={slug} insights={insights} birthdayClients={birthdayClients} />;
}

function GestorInsightsCard({
  slug,
  insights,
  birthdayClients,
}: {
  slug: string;
  insights: Insight[];
  birthdayClients: BirthdayContact[];
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 shadow-sm">
      {/* brilho decorativo no canto — dá o toque "assistente" sem pesar */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Sparkle className="h-[18px] w-[18px]" weight="fill" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Gestor Zulan</p>
            <p className="text-xs text-muted-foreground">
              <TypewriterText text={insights.length > 0 ? "Encontrei isso hoje pra você" : "Já passei pelo salão hoje"} />
            </p>
          </div>
        </div>
        <RefreshGestorButton slug={slug} />
      </div>

      {insights.length === 0 ? (
        <p className="relative mt-3 text-sm text-muted-foreground">
          <TypewriterText text="Tudo tranquilo por aqui — sem pendência ou oportunidade pra te mostrar agora." />
        </p>
      ) : (
        <InsightsCarousel
          items={insights.map((insight, i) => {
            const Icon = ICON[insight.type];
            const href = hrefFor(slug, insight.type);
            const sk = signalKeyForInsight(insight.type); // categoria dispensável (ou null)
            // af-rise com atraso escalonado: cards "se montam" em sequência,
            // reforçando a sensação de algo sendo organizado na hora.
            const style = { animationDelay: `${220 + i * 90}ms` };

            // Aniversário tem ação própria (parabenizar nominal), não um link genérico —
            // a IA só narra; quem manda o link pronto é o código, com dado real do cliente.
            if (insight.type === "birthday" && birthdayClients.length > 0) {
              return (
                <DismissibleCard key={i} slug={slug} signalKey={sk}>
                <div
                  style={style}
                  className={`af-rise flex h-full flex-col gap-2 rounded-[var(--radius)] border p-3 pr-8 transition ${CARD_STYLE[insight.priority]}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card ${ICON_ACCENT[insight.priority]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{insight.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[insight.priority]}`}
                        >
                          {insight.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-11">
                    {birthdayClients.map((c) => {
                      const url = birthdayWaUrl(c);
                      return url ? (
                        <a
                          key={c.id}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-600/15 transition"
                        >
                          <ChatCircle className="h-3.5 w-3.5" /> Parabenizar {c.name.split(" ")[0]}
                        </a>
                      ) : (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {c.name.split(" ")[0]} — sem WhatsApp cadastrado
                        </span>
                      );
                    })}
                  </div>
                </div>
                </DismissibleCard>
              );
            }

            const content = (
              <>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card ${ICON_ACCENT[insight.priority]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{insight.title}</p>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[insight.priority]}`}
                    >
                      {insight.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                </div>
                {href && <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground self-center transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
              </>
            );

            return (
              <DismissibleCard key={i} slug={slug} signalKey={sk}>
                {href ? (
                  <Link
                    href={href}
                    style={style}
                    className={`af-rise group flex h-full items-start gap-3 rounded-[var(--radius)] border p-3 pr-8 transition hover:-translate-y-0.5 hover:shadow-sm ${CARD_STYLE[insight.priority]}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    style={style}
                    className={`af-rise flex h-full items-start gap-3 rounded-[var(--radius)] border p-3 pr-8 transition ${CARD_STYLE[insight.priority]}`}
                  >
                    {content}
                  </div>
                )}
              </DismissibleCard>
            );
          })}
        />
      )}
    </div>
  );
}
