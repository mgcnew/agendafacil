import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { AgendaManager } from "./AgendaManager";

export const dynamic = "force-dynamic";

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const [{ data: pros }, { data: services }, { data: clients }, { data: discountRows }] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, profiles(full_name), commission_percent, color")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true),
    supabase
      .from("services")
      .select("id, name, duration_min, price, commission_percent")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true),
    supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("salon_id", membership.salon_id)
      .order("full_name"),
    supabase.rpc("public_campaign_discounts", { p_salon: membership.salon_id }),
  ]);

  const discounts: Record<string, number> = {};
  for (const r of (discountRows as { service_id: string; discount_percent: number }[] | null) ?? []) {
    discounts[r.service_id] = Number(r.discount_percent);
  }

  const proList = (pros ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? (p.profiles as { full_name?: string } | null)?.full_name ?? "—",
    commission_percent: p.commission_percent,
    color: p.color,
  }));

  return (
    <AgendaManager
      salonId={membership.salon_id}
      pros={proList}
      services={services ?? []}
      clients={clients ?? []}
      discounts={discounts}
    />
  );
}
