import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { RecuperarManager } from "./RecuperarManager";

export const dynamic = "force-dynamic";

export default async function RecuperarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  await guardFeature(slug, "/recuperar");

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (!perms.has("clients.view")) redirect(`/painel/${slug}`);

  const salonId = membership.salon_id;
  const supabase = await createClient();

  const [{ data: winback }, { data: campaigns }, { data: performanceRows }] = await Promise.all([
    supabase.rpc("marketing_winback" as never, { p_salon: salonId } as never),
    supabase
      .from("campaigns")
      .select("id, name, discount_percent")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Fecha o loop "criei cupom de reativação → quanto ele já trouxe" (campaign_performance, v2 de Campanhas).
    supabase.rpc("campaign_performance" as never, { p_salon: salonId } as never),
  ]);

  const data = (winback ?? { no_shows: [], cancelled: [], inactive: [] }) as {
    no_shows: never[]; cancelled: never[]; inactive: never[];
  };

  const performance = Object.fromEntries(
    ((performanceRows as unknown as {
      campaign_id: string;
      bookings: number;
      revenue: number;
      discount_given: number;
    }[]) ?? []).map((r) => [r.campaign_id, r]),
  );

  return (
    <RecuperarManager
      salonId={salonId}
      initialData={data}
      campaigns={campaigns ?? []}
      performance={performance}
      salonName={membership.salons.name}
      slug={slug}
    />
  );
}
