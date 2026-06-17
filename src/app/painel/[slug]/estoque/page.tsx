import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager, type Movement } from "./InventoryManager";

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
  const [{ data: products }, { data: movements }] = await Promise.all([
    supabase.from("products").select("*").eq("salon_id", membership.salon_id).order("name"),
    supabase
      .from("stock_movements")
      .select("id, type, quantity, reason, created_at, products(name)")
      .eq("salon_id", membership.salon_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const canManage = membership.role === "owner" || membership.role === "manager";

  return (
    <InventoryManager
      salonId={membership.salon_id}
      initial={products ?? []}
      movements={(movements ?? []) as unknown as Movement[]}
      canManage={canManage}
    />
  );
}
