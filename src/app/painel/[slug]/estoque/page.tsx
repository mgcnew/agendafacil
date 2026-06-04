import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "./InventoryManager";

export const dynamic = "force-dynamic";

export default async function EstoquePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("salon_id", membership.salon_id)
    .order("name");

  const canManage = membership.role === "owner" || membership.role === "manager";

  return (
    <InventoryManager
      salonId={membership.salon_id}
      initial={products ?? []}
      canManage={canManage}
    />
  );
}
