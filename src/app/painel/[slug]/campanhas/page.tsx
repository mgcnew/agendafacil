import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { CampaignsManager } from "./CampaignsManager";

export const dynamic = "force-dynamic";

export default async function CampanhasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  await guardFeature(slug, "/campanhas");

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (!perms.has("services.manage")) redirect(`/painel/${slug}`);

  const supabase = await createClient();
  const [{ data: campaigns }, { data: services }, { data: campaignServices }, { data: performanceRows }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("*")
      .eq("salon_id", membership.salon_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("services")
      .select("id, name, price, price_type")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("campaign_services")
      .select("campaign_id, service_id")
      .eq("salon_id", membership.salon_id),
    // Medição de performance (v2 do roadmap de IA) — agendamentos/receita/desconto
    // concedido por campanha, só a partir de quando a atribuição passou a ser gravada.
    supabase.rpc("campaign_performance" as never, { p_salon: membership.salon_id } as never),
  ]);

  const performance = Object.fromEntries(
    ((performanceRows as unknown as {
      campaign_id: string;
      bookings: number;
      revenue: number;
      discount_given: number;
    }[]) ?? []).map((r) => [r.campaign_id, r]),
  );

  return (
    <CampaignsManager
      salonId={membership.salon_id}
      initial={campaigns ?? []}
      services={services ?? []}
      campaignServices={campaignServices ?? []}
      performance={performance}
    />
  );
}
