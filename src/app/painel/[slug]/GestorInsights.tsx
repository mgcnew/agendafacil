import Link from "next/link";
import {
  Robot,
  UserCheck,
  Cake,
  Package,
  Wallet,
  Sparkle,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import type { Insight, InsightType } from "@/lib/ai/dashboardInsights";

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

export function GestorInsights({
  slug,
  greeting,
  insights,
}: {
  slug: string;
  greeting: string;
  insights: Insight[];
}) {
  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Robot className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">{greeting}</p>
          <p className="text-xs text-muted-foreground">
            {insights.length > 0
              ? "Sua equipe virtual encontrou isso hoje"
              : "Sua equipe virtual já passou pelo salão hoje"}
          </p>
        </div>
      </div>

      {insights.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Tudo tranquilo por aqui — sem pendência ou oportunidade pra te mostrar agora.
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

          return href ? (
            <Link
              key={i}
              href={href}
              className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-background p-3 transition hover:border-primary/40"
            >
              {content}
            </Link>
          ) : (
            <div
              key={i}
              className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-background p-3"
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
