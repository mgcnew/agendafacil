import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
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

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  const canManageSchedule = perms.has("schedule.manage");

  const supabase = await createClient();
  const [{ data: pros }, { data: services }, { data: clients }, { data: discountRows }, { data: proSvcRows }, { data: salonRow }] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, profiles(full_name), commission_percent, color")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true),
    supabase
      .from("services")
      .select("id, name, duration_min, price, commission_percent, color")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true),
    supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("salon_id", membership.salon_id)
      .order("full_name"),
    supabase.rpc("public_campaign_discounts", { p_salon: membership.salon_id }),
    supabase
      .from("professional_services")
      .select("member_id")
      .eq("salon_id", membership.salon_id),
    supabase
      .from("salons")
      .select("agenda_color_mode")
      .eq("id", membership.salon_id)
      .maybeSingle(),
  ]);

  const colorMode = ((salonRow as { agenda_color_mode?: string } | null)?.agenda_color_mode === "service"
    ? "service"
    : "professional") as "professional" | "service";

  const discounts: Record<string, number> = {};
  for (const r of (discountRows as { service_id: string; discount_percent: number }[] | null) ?? []) {
    discounts[r.service_id] = Number(r.discount_percent);
  }

  // Only show professionals who have at least one service assigned.
  const prosWithServices = new Set((proSvcRows ?? []).map((r) => r.member_id));
  const proList = (pros ?? [])
    .filter((p) => prosWithServices.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.display_name ?? (p.profiles as { full_name?: string } | null)?.full_name ?? "—",
      commission_percent: p.commission_percent,
      color: p.color,
    }));

  return (
    <AgendaManager
      salonId={membership.salon_id}
      slug={slug}
      pros={proList}
      services={services ?? []}
      clients={clients ?? []}
      discounts={discounts}
      canManageSchedule={canManageSchedule}
      myMemberId={membership.id}
      colorMode={colorMode}
    />
  );
}
