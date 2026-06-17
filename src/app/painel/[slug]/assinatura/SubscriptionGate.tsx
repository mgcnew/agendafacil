import Link from "next/link";
import { SubscribePanel } from "./SubscribePanel";
import { type AccessStatus } from "@/lib/subscription";

/** Tela cheia exibida quando o salão está sem acesso (trial vencido / pagamento pendente). */
export function SubscriptionGate({
  slug,
  salonName,
  access,
}: {
  slug: string;
  salonName: string;
  access: AccessStatus;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-5 py-12">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-bold">{salonName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {access.status === "past_due"
            ? "Seu acesso está pausado por falta de pagamento."
            : "Seu período de teste terminou."}{" "}
          Assine para continuar usando o painel.
        </p>
      </div>

      <SubscribePanel
        slug={slug}
        status={access.status}
        trialEndsAt={access.trial_ends_at}
        currentPeriodEnd={access.current_period_end}
        plan={access.plan}
      />

      <Link
        href="/painel"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Voltar aos meus salões
      </Link>
    </div>
  );
}
