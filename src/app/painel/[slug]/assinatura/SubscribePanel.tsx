"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2, AlertCircle, Check } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { createCheckout } from "./actions";
import type { SubStatus } from "@/lib/subscription";
import { PLANS, priceLabel, type PlanId } from "@/lib/plans";

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
}: {
  slug: string;
  status: SubStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  plan: PlanId;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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

  // Assinatura ativa: só mostra o plano atual e a renovação.
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
        <p className="mt-4 text-sm text-foreground">
          Próxima renovação em <strong>{fmtDate(currentPeriodEnd)}</strong>.
        </p>
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
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button onClick={subscribe} disabled={pending} className="mt-5 w-full" size="lg">
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
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
