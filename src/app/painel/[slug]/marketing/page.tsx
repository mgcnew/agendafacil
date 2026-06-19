import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { getCredits } from "@/lib/marketing/credits";
import { MarketingManager } from "./MarketingManager";

export const dynamic = "force-dynamic";

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const salonId = membership.salon_id;

  const [{ data: services }, { data: campaigns }, credits] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price, price_type")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("campaigns")
      .select("id, name, discount_percent")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    getCredits(supabase, salonId),
  ]);

  const salon = membership.salons;

  return (
    <MarketingManager
      slug={slug}
      salon={{
        name: salon.name,
        logoUrl: salon.logo_url ?? null,
        phone: salon.phone ?? null,
        colorTheme: (salon.color_theme ?? "a") as string,
      }}
      services={services ?? []}
      campaigns={campaigns ?? []}
      credits={credits}
    />
  );
}
