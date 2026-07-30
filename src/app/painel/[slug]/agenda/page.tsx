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
  // Estas duas já valiam no RLS, mas sem efeito nenhum na tela: os botões
  // continuavam ali e o erro só aparecia ao salvar. Desligar a permissão
  // precisa ser visível pra quem usa, não só pro banco.
  const canManageAppointments = perms.has("appointments.manage");
  const canViewAllAppointments = perms.has("appointments.view_all");

  const supabase = await createClient();
  const [{ data: pros }, { data: services }, { data: clients }, { data: discountRows }, { data: proSvcRows }, { data: salonCfg }] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, profiles(full_name), commission_percent, color, photo_url")
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
      .select("cash_discount_enabled, cash_max_discount_percent, home_service_enabled, home_first_km_fee, home_extra_km_fee, home_max_km, street, street_number, neighborhood, city, state, address")
      .eq("id", membership.salon_id)
      .maybeSingle(),
  ]);

  // Mesma config de desconto do Caixa — o fechamento pela Agenda usa o mesmo modal.
  const canDiscount = !!salonCfg?.cash_discount_enabled && perms.has("cash.discount");
  const maxDiscountPercent = Number(salonCfg?.cash_max_discount_percent ?? 0);

  // Origem do trajeto no Maps: o endereço estruturado quando existe, senão o
  // texto livre antigo. Sem endereço nenhum o atalho vira busca pelo destino.
  const origemMaps =
    [salonCfg?.street, salonCfg?.street_number].filter(Boolean).join(", ") ||
    salonCfg?.address ||
    null;
  const origemCompleta = origemMaps
    ? [origemMaps, salonCfg?.neighborhood, [salonCfg?.city, salonCfg?.state].filter(Boolean).join("/")]
        .filter(Boolean)
        .join(" — ")
    : null;

  const homeVisit = {
    tarifa: {
      firstKmFee: Number(salonCfg?.home_first_km_fee ?? 0),
      extraKmFee: Number(salonCfg?.home_extra_km_fee ?? 0),
    },
    maxKm: salonCfg?.home_max_km == null ? null : Number(salonCfg.home_max_km),
    origem: origemCompleta,
  };

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
      photo_url: p.photo_url,
    }));

  return (
    <AgendaManager
      salonId={membership.salon_id}
      slug={slug}
      pros={proList}
      homeVisit={homeVisit}
      services={services ?? []}
      clients={clients ?? []}
      discounts={discounts}
      canManageSchedule={canManageSchedule}
      canManageAppointments={canManageAppointments}
      canViewAllAppointments={canViewAllAppointments}
      myMemberId={membership.id}
      canDiscount={canDiscount}
      maxDiscountPercent={maxDiscountPercent}
    />
  );
}
