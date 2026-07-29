import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/AccessDenied";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
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

  // Mesma permissão que o menu já declarava. A tela gasta créditos de
  // geração de arte, então não é só leitura.
  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (!perms.has("marketing.manage")) {
    return <AccessDenied slug={slug} permissao="Criar artes de divulgação (usa créditos)" />;
  }

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
        colorTheme: (salon.color_theme || "a") as string,
      }}
      services={services ?? []}
      campaigns={campaigns ?? []}
      credits={credits}
    />
  );
}
