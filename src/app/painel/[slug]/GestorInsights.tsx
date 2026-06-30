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
} from "@phosphor-icons/react/dist/ssr";
import {
  getOrGenerateDashboardInsights,
  type DashboardSignals,
  type Insight,
  type InsightType,
} from "@/lib/ai/dashboardInsights";
import { RefreshGestorButton } from "./RefreshGestorButton";
import { TypewriterText } from "./TypewriterText";

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
  revenue: Wallet,
  low_stock: Stack,
  general: Sparkle,
};

const PRIORITY_STYLE: Record<Insight["priority"], string> = {
  alta: "bg-amber-500/12 text-amber-600",
  media: "bg-secondary text-primary",
  baixa: "bg-muted text-muted-foreground",
};

function hrefFor(slug: string, type: InsightType): string | null {
  switch (type) {
    case "reactivation":
      return `/painel/${slug}/recuperar`;
    case "package_expiring":
      return `/painel/${slug}/pacotes`;
    case "revenue":
      return `/painel/${slug}/financeiro`;
    case "low_stock":
      return `/painel/${slug}/estoque`;
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
  signals,
  birthdayClients,
}: {
  slug: string;
  supabase: SupabaseClient;
  salonId: string;
  signals: DashboardSignals;
  birthdayClients: BirthdayContact[];
}) {
  const result = await getOrGenerateDashboardInsights(supabase, salonId, signals);
  return <GestorInsightsCard slug={slug} insights={result.insights} birthdayClients={birthdayClients} />;
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
    <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Sparkle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Gestor Zulan</p>
            <p className="text-xs text-muted-foreground">
              <TypewriterText text={insights.length > 0 ? "Encontrei isso hoje pra você" : "Já passei pelo salão hoje"} />
            </p>
          </div>
        </div>
        <RefreshGestorButton slug={slug} />
      </div>

      {insights.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <TypewriterText text="Tudo tranquilo por aqui — sem pendência ou oportunidade pra te mostrar agora." />
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {insights.map((insight, i) => {
            const Icon = ICON[insight.type];
            const href = hrefFor(slug, insight.type);
            // af-rise com atraso escalonado: cards "se montam" em sequência,
            // reforçando a sensação de algo sendo organizado na hora.
            const style = { animationDelay: `${220 + i * 90}ms` };

            // Aniversário tem ação própria (parabenizar nominal), não um link genérico —
            // a IA só narra; quem manda o link pronto é o código, com dado real do cliente.
            if (insight.type === "birthday" && birthdayClients.length > 0) {
              return (
                <div
                  key={i}
                  style={style}
                  className="af-rise flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-background p-3 sm:col-span-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card text-primary">
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
              );
            }

            const content = (
              <>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card text-primary">
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
                {href && <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground self-center" />}
              </>
            );

            return href ? (
              <Link
                key={i}
                href={href}
                style={style}
                className="af-rise flex items-start gap-3 rounded-[var(--radius)] border border-border bg-background p-3 transition hover:border-primary/40"
              >
                {content}
              </Link>
            ) : (
              <div
                key={i}
                style={style}
                className="af-rise flex items-start gap-3 rounded-[var(--radius)] border border-border bg-background p-3"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
