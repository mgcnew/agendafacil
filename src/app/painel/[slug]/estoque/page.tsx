import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { buildProductInsightMap, type ProductInsightRow } from "@/lib/productInsights";
import { InventoryManager } from "./InventoryManager";
import { MOVEMENTS_PAGE_SIZE, type Movement } from "./types";

export const dynamic = "force-dynamic";

export default async function EstoquePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  await guardFeature(slug, "/estoque");

  const supabase = await createClient();
  const [{ data: products }, { data: movements }, { data: insightRows }] = await Promise.all([
    supabase.from("products").select("*").eq("salon_id", membership.salon_id).order("name"),
    supabase
      .from("stock_movements")
      .select("id, type, quantity, reason, created_at, products(name)")
      .eq("salon_id", membership.salon_id)
      .order("created_at", { ascending: false })
      .range(0, MOVEMENTS_PAGE_SIZE), // +1 p/ saber se há mais sem query de contagem
    // Consumo real (30 dias) — v1 do roadmap de IA p/ Estoque.
    supabase.rpc("product_movement_stats" as never, { p_salon: membership.salon_id } as never),
  ]);

  const canManage = membership.role === "owner" || membership.role === "manager";
  const insights = buildProductInsightMap((insightRows as ProductInsightRow[] | null) ?? []);
  const movementRows = (movements ?? []) as unknown as Movement[];
  const movementsHasMore = movementRows.length > MOVEMENTS_PAGE_SIZE;

  return (
    <InventoryManager
      slug={slug}
      salonId={membership.salon_id}
      initial={products ?? []}
      movements={movementRows.slice(0, MOVEMENTS_PAGE_SIZE)}
      movementsHasMore={movementsHasMore}
      canManage={canManage}
      insights={insights}
    />
  );
}
