import { redirect, notFound } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { computeVipIds, nextBirthday, type ClientOverviewRow } from "@/lib/clients";
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

  const [{ data: anamnesis }, { data: history }, { data: allAppts }, { data: overviewRows }, { data: reactRaw }] =
    await Promise.all([
      supabase.from("client_anamnesis").select("*").eq("client_id", id).maybeSingle(),
      supabase
        .from("appointments")
        .select("id, starts_at, status, total_price, salon_members(display_name)")
        .eq("client_id", id)
        .order("starts_at", { ascending: false })
        .limit(50),
      // Todos os agendamentos (qualquer status) — alimenta resumo de valor, faltas/cancelamentos e profissional favorito.
      supabase
        .from("appointments")
        .select("total_price, starts_at, status, salon_members(display_name)")
        .eq("client_id", id)
        .eq("salon_id", membership.salon_id),
      // Pra calcular se esse cliente é VIP (top 20% de gasto do salão) — guard de amostra mínima embutido.
      supabase.rpc("clients_overview", { p_salon: membership.salon_id }),
      // Mesma fórmula já usada no /recuperar — se esse cliente está acima do ritmo normal dele.
      supabase.rpc("report_reactivation" as never, { p_salon: membership.salon_id, p_min_days: 14 } as never),
    ]);

  const all = allAppts ?? [];
  const completed = all.filter((a) => a.status === "completed");
  const visits = completed.length;
  const totalSpent = completed.reduce((s, r) => s + Number(r.total_price ?? 0), 0);
  const lastVisit = completed.reduce<string | null>(
    (acc, r) => (!acc || r.starts_at > acc ? r.starts_at : acc),
    null,
  );
  const noShows = all.filter((a) => a.status === "no_show").length;
  const cancellations = all.filter((a) => a.status === "cancelled").length;

  const proCount: Record<string, number> = {};
  for (const a of completed) {
    const name = (a.salon_members as { display_name?: string | null } | null)?.display_name;
    if (name) proCount[name] = (proCount[name] ?? 0) + 1;
  }
  const favoritePro =
    Object.entries(proCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const stats = {
    visits,
    totalSpent,
    avgTicket: visits > 0 ? totalSpent / visits : 0,
    lastVisit,
    noShows,
    cancellations,
    favoritePro,
  };

  const isVip = computeVipIds((overviewRows as ClientOverviewRow[] | null) ?? []).has(id);
  const birthday = nextBirthday(client.birth_date);

  const reactArr = (reactRaw as { id: string; overdue_by: number; days_since: number }[] | null) ?? [];
  const reactivation = Array.isArray(reactArr) ? reactArr.find((r) => r.id === id) ?? null : null;

  return (
    <ClientDetail
      slug={slug}
      client={client}
      anamnesis={anamnesis ?? null}
      history={history ?? []}
      stats={stats}
      canManage={canManage}
      niche={membership.salons.niche}
      isVip={isVip}
      birthday={birthday}
      reactivation={reactivation ? { daysSince: reactivation.days_since, overdueBy: reactivation.overdue_by } : null}
    />
  );
}
