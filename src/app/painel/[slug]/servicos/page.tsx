import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { buildServiceInsightMap, type ServiceInsightRow } from "@/lib/serviceInsights";
import { ServicesManager } from "./ServicesManager";

export const dynamic = "force-dynamic";

export default async function ServicosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const [{ data: services }, { data: products }, { data: serviceProducts }, { data: categories }, { data: insightRows }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("salon_id", membership.salon_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, unit, cost_price")
        .eq("salon_id", membership.salon_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("service_products")
        .select("service_id, product_id, quantity")
        .eq("salon_id", membership.salon_id),
      supabase
        .from("service_categories")
        .select("id, name, sort_order")
        .eq("salon_id", membership.salon_id)
        .order("sort_order"),
      // Histórico real de uso (90 dias) — v1 do roadmap de IA p/ Serviços.
      supabase.rpc("service_insights" as never, { p_salon: membership.salon_id } as never),
    ]);

  const insights = buildServiceInsightMap((insightRows as ServiceInsightRow[] | null) ?? []);

  return (
    <ServicesManager
      salonId={membership.salon_id}
      niche={membership.salons.niche}
      initial={services ?? []}
      products={products ?? []}
      serviceProducts={serviceProducts ?? []}
      initialCategories={(categories ?? []) as { id: string; name: string; sort_order: number }[]}
      insights={insights}
    />
  );
}
