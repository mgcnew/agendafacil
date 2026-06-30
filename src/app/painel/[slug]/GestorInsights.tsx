import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Robot,
  UserCheck,
  Cake,
  Package,
  Wallet,
  Sparkle,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import {
  getOrGenerateDashboardInsights,
  type DashboardSignals,
  type Insight,
  type InsightType,
} from "@/lib/ai/dashboardInsights";
import { RefreshGestorButton } from "./RefreshGestorButton";
import { TypewriterText } from "./TypewriterText";

const ICON: Record<InsightType, React.ComponentType<{ className?: string }>> = {
  reactivation: UserCheck,
  birthday: Cake,
  package_expiring: Package,
  revenue: Wallet,
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
}: {
  slug: string;
  supabase: SupabaseClient;
  salonId: string;
  signals: DashboardSignals;
}) {
  const result = await getOrGenerateDashboardInsights(supabase, salonId, signals);
  return <GestorInsightsCard slug={slug} insights={result.insights} />;
}

function GestorInsightsCard({ slug, insights }: { slug: string; insights: Insight[] }) {
  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Robot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Sua equipe virtual</p>
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

            // af-rise com atraso escalonado: cards "se montam" em sequência,
            // reforçando a sensação de algo sendo organizado na hora.
            const style = { animationDelay: `${220 + i * 90}ms` };

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
