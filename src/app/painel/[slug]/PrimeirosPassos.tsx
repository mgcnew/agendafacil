import Link from "next/link";
import { CheckCircle, Circle, CaretRight, Rocket } from "@phosphor-icons/react/dist/ssr";
import { DismissOnboardingButton } from "./DismissOnboardingButton";

export type OnboardingStep = {
  done: boolean;
  title: string;
  hint: string;
  href: string;
  cta: string;
};

/**
 * Checklist "Primeiros passos" — orienta o dono novo *fazendo*: cada item é
 * detectado por dado real (não é checkbox manual) e some quando concluído. O
 * card inteiro só aparece pro dono, some quando tudo está feito ou quando ele
 * dispensa ("Já conheço"). Sem tour de coach-marks (frágil/manutenção alta).
 */
export function PrimeirosPassos({ slug, steps }: { slug: string; steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((doneCount / total) * 100);
  // Próximo passo pendente ganha o destaque do CTA.
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-sm">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Rocket className="h-[18px] w-[18px]" weight="fill" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Primeiros passos</p>
            <p className="text-xs text-muted-foreground">
              {doneCount} de {total} concluídos — vamos deixar seu salão redondo
            </p>
          </div>
        </div>
        <DismissOnboardingButton slug={slug} />
      </div>

      {/* Barra de progresso */}
      <div className="relative mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Itens */}
      <div className="relative mt-4 space-y-1.5">
        {steps.map((s, i) => {
          const Icon = s.done ? CheckCircle : Circle;
          const isNext = i === nextIdx;
          const row = (
            <div
              className={`flex items-center gap-3 rounded-[var(--radius)] border p-3 transition ${
                s.done
                  ? "border-transparent bg-transparent"
                  : isNext
                    ? "border-primary/30 bg-primary/[0.04] hover:border-primary/50"
                    : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${s.done ? "text-emerald-600" : isNext ? "text-primary" : "text-muted-foreground"}`}
                weight={s.done ? "fill" : "regular"}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.title}</p>
                {!s.done && <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>}
              </div>
              {!s.done && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                  {s.cta} <CaretRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
          // Concluído não precisa de link (nada a fazer); pendente leva à página.
          return s.done ? (
            <div key={i}>{row}</div>
          ) : (
            <Link key={i} href={s.href} className="block">
              {row}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
