import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { PackagesManager, type Template, type Sold } from "./PackagesManager";

export const dynamic = "force-dynamic";

export default async function PacotesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  const salonId = membership.salon_id;

  const perms = await getEffectivePermissions(salonId, membership);
  if (!perms.has("packages.view")) redirect(`/painel/${slug}`);
  const canManage = perms.has("packages.manage");

  const supabase = await createClient();
  const [{ data: templates }, { data: sold }, { data: services }, { data: clients }, { data: pros }] =
    await Promise.all([
      supabase
        .from("package_templates")
        .select("*, package_template_items(id, service_id, quantity, services(name))")
        .eq("salon_id", salonId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_packages")
        .select("*, clients(full_name), client_package_items(*)")
        .eq("salon_id", salonId)
        .order("purchased_at", { ascending: false })
        .limit(100),
      supabase
        .from("services")
        .select("id, name, price, commission_percent")
        .eq("salon_id", salonId)
        .eq("is_active", true)
        .order("name"),
      supabase.from("clients").select("id, full_name").eq("salon_id", salonId).order("full_name"),
      supabase
        .from("salon_members")
        .select("id, display_name, profiles(full_name)")
        .eq("salon_id", salonId)
        .eq("is_active", true)
        .order("created_at"),
    ]);

  const proList = (pros ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? (p.profiles as { full_name?: string } | null)?.full_name ?? "—",
  }));

  return (
    <PackagesManager
      salonId={salonId}
      canManage={canManage}
      templates={(templates ?? []) as unknown as Template[]}
      sold={(sold ?? []) as unknown as Sold[]}
      services={services ?? []}
      clients={clients ?? []}
      pros={proList}
    />
  );
}
