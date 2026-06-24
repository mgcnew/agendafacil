"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCircleDown,
  ArrowCircleUp,
  Check,
  CircleNotch,
  CreditCard,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Button, Card, Input } from "@/components/ui";
import { createCheckout, changePlan } from "./actions";
import type { SubStatus } from "@/lib/subscription";
import { PLANS, planRank, priceLabel, type PlanId } from "@/lib/plans";

const STATUS_LABEL: Record<SubStatus, { text: string; cls: string }> = {
  trialing: { text: "Período de teste", cls: "bg-accent/15 text-accent" },
  active: { text: "Ativa", cls: "bg-green-500/15 text-green-700" },
  past_due: { text: "Pagamento pendente", cls: "bg-red-500/15 text-red-700" },
  canceled: { text: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function SubscribePanel({
  slug,
  status,
  trialEndsAt,
  currentPeriodEnd,
  plan,
  pendingPlan,
}: {
  slug: string;
  status: SubStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  plan: PlanId;
  pendingPlan: PlanId | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [selected, setSelected] = useState<PlanId>("pro");
  const badge = STATUS_LABEL[status];

  function subscribe() {
    setError(null);
    const digits = doc.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
      return;
    }
    start(async () => {
      const res = await createCheckout(slug, selected, digits);
      if ("url" in res) window.location.href = res.url;
      else setError(res.error);
    });
  }

  function doChange(target: PlanId) {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await changePlan(slug, target);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if (res.mode === "upgrade") setInfo(`Plano atualizado para ${PLANS[target].name}. Já está valendo!`);
      else if (res.mode === "downgrade") setInfo(`Mudança para ${PLANS[target].name} agendada para a próxima renovação (${fmtDate(currentPeriodEnd)}). Até lá você continua no ${PLANS[plan].name}.`);
      else setInfo("Mudança de plano cancelada.");
      router.refresh();
    });
  }

  // Assinatura ativa: mostra o plano atual e permite upgrade/downgrade.
  if (status === "active") {
    return (
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">
            Plano {PLANS[plan].name}
          </h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
            {badge.text}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {priceLabel(PLANS[plan].value)} por mês · cancele quando quiser
        </p>
        <p className="mt-3 text-sm text-foreground">
          Próxima renovação em <strong>{fmtDate(currentPeriodEnd)}</strong>.
        </p>

        {pendingPlan && pendingPlan !== plan && (
          <div className="mt-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ⏳ A partir da próxima renovação, seu plano passa a ser{" "}
            <strong>{PLANS[pendingPlan].name}</strong> ({priceLabel(PLANS[pendingPlan].value)}/mês).
            <button
              type="button"
              onClick={() => doChange(plan)}
              disabled={pending}
              className="ml-1 underline hover:no-underline disabled:opacity-50"
            >
              Cancelar mudança
            </button>
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">Mudar de plano</p>
          <div className="mt-3 space-y-2.5">
            {Object.values(PLANS).map((p) => {
              const isCurrent = p.id === plan;
              const soon = !!p.comingSoon;
              const isUpgrade = planRank(p.id) > planRank(plan);
              return (
                <div
                  key={p.id}
                  className={[
                    "rounded-[var(--radius)] border p-3",
                    isCurrent ? "border-primary bg-primary/5" : "border-border",
                    soon ? "opacity-70" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground">{p.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {priceLabel(p.value)}/mês
                      </span>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-semibold text-primary shrink-0">Plano atual</span>
                    ) : soon ? (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent shrink-0">
                        Em breve
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={isUpgrade ? "primary" : "outline"}
                        onClick={() => doChange(p.id)}
                        disabled={pending}
                        className="shrink-0"
                      >
                        {isUpgrade ? <ArrowCircleUp className="h-4 w-4" /> : <ArrowCircleDown className="h-4 w-4" />}
                        {isUpgrade ? "Subir" : "Descer"}
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isCurrent
                      ? p.tagline
                      : isUpgrade
                        ? "Vale na hora."
                        : "Vale no fim do ciclo (você não perde o que já pagou)."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {info && (
          <div className="mt-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {info}
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Escolha seu plano</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
          {badge.text}
        </span>
      </div>

      {status === "trialing" && (
        <p className="mt-1 text-sm text-muted-foreground">
          Teste grátis até <strong>{fmtDate(trialEndsAt)}</strong>.
        </p>
      )}
      {status === "past_due" && (
        <p className="mt-1 text-sm text-red-700">
          Não identificamos o pagamento. Reative para continuar.
        </p>
      )}

      <div className="mt-4 space-y-2.5">
        {Object.values(PLANS).map((p) => {
          const disabled = !!p.comingSoon;
          const active = selected === p.id && !disabled;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(p.id)}
              className={[
                "w-full rounded-[var(--radius)] border p-3 text-left transition-colors",
                disabled
                  ? "cursor-not-allowed border-border bg-muted/40 opacity-70"
                  : active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  {p.name}
                  {disabled && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      Em breve
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {priceLabel(p.value)}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.tagline}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label htmlFor="cpfCnpj" className="text-sm font-medium text-foreground">
          CPF ou CNPJ do responsável
        </label>
        <Input
          id="cpfCnpj"
          inputMode="numeric"
          placeholder="Somente números"
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Necessário para emitir a cobrança no Asaas.
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button onClick={subscribe} disabled={pending} className="mt-5 w-full" size="lg">
        {pending ? (
          <CircleNotch className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            Assinar {PLANS[selected].name} · {priceLabel(PLANS[selected].value)}/mês
          </>
        )}
      </Button>
    </Card>
  );
}
