import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
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
  const [{ data: services }, { data: products }, { data: serviceProducts }] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("salon_id", membership.salon_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, unit")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("service_products")
      .select("service_id, product_id, quantity")
      .eq("salon_id", membership.salon_id),
  ]);

  return (
    <ServicesManager
      salonId={membership.salon_id}
      niche={membership.salons.niche}
      initial={services ?? []}
      products={products ?? []}
      serviceProducts={serviceProducts ?? []}
    />
  );
}
