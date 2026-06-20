import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { GaleriaManager } from "./GaleriaManager";

export const dynamic = "force-dynamic";

export default async function GaleriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  const canManage = perms.has("salon.manage");

  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("salon_gallery")
    .select("id, url, caption")
    .eq("salon_id", membership.salon_id)
    .order("sort_order");

  return (
    <GaleriaManager
      slug={slug}
      initial={photos ?? []}
      canManage={canManage}
    />
  );
}
