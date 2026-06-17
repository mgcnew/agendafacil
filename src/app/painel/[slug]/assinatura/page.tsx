import { redirect } from "next/navigation";
import { getAccessStatus } from "@/lib/subscription";
import { SubscribePanel } from "./SubscribePanel";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getAccessStatus(slug);
  if (!access) redirect("/painel");

  return (
    <div className="p-4 md:p-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Assinatura</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gerencie o plano do seu salão.
      </p>

      <div className="mt-6">
        <SubscribePanel
          slug={slug}
          status={access.status}
          trialEndsAt={access.trial_ends_at}
          currentPeriodEnd={access.current_period_end}
          plan={access.plan}
          pendingPlan={access.pending_plan}
        />
      </div>
    </div>
  );
}
