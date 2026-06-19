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

  const [{ data: anamnesis }, { data: history }, { data: completed }] = await Promise.all([
    supabase.from("client_anamnesis").select("*").eq("client_id", id).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, total_price, salon_members(display_name)")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(50),
    // Todos os concluídos (só 2 colunas) para o resumo de valor do cliente.
    supabase
      .from("appointments")
      .select("total_price, starts_at")
      .eq("client_id", id)
      .eq("salon_id", membership.salon_id)
      .eq("status", "completed"),
  ]);

  const visits = completed?.length ?? 0;
  const totalSpent = (completed ?? []).reduce((s, r) => s + Number(r.total_price ?? 0), 0);
  const lastVisit = (completed ?? []).reduce<string | null>(
    (acc, r) => (!acc || r.starts_at > acc ? r.starts_at : acc),
    null,
  );
  const stats = {
    visits,
    totalSpent,
    avgTicket: visits > 0 ? totalSpent / visits : 0,
    lastVisit,
  };

  return (
    <ClientDetail
      slug={slug}
      client={client}
      anamnesis={anamnesis ?? null}
      history={history ?? []}
      stats={stats}
      canManage={canManage}
      niche={membership.salons.niche}
    />
  );
}
