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
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", membership.salon_id)
    .order("created_at", { ascending: false });

  return (
    <ServicesManager
      salonId={membership.salon_id}
      initial={services ?? []}
    />
  );
}
