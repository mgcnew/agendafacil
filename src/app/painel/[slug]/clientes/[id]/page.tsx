import { redirect, notFound } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { ClientDetail } from "./ClientDetail";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  const canManage = perms.has("clients.manage");

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("salon_id", membership.salon_id)
    .maybeSingle();
  if (!client) notFound();

  const [{ data: anamnesis }, { data: history }] = await Promise.all([
    supabase.from("client_anamnesis").select("*").eq("client_id", id).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, total_price, salon_members(display_name)")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <ClientDetail
      slug={slug}
      client={client}
      anamnesis={anamnesis ?? null}
      history={history ?? []}
      canManage={canManage}
    />
  );
}
