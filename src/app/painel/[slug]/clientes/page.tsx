import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { computeVipIds, type ClientOverviewRow } from "@/lib/clients";
import { ClientsManager } from "./ClientsManager";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const [{ data: clients }, { data: overview }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("salon_id", membership.salon_id)
      .order("full_name"),
    supabase.rpc("clients_overview", { p_salon: membership.salon_id }),
  ]);

  // Mapa client_id → última visita (ISO) para mostrar/filtrar inativas.
  const lastVisit: Record<string, string> = {};
  for (const r of overview ?? []) {
    if (r.last_visit) lastVisit[r.client_id] = r.last_visit;
  }

  const vipIds = Array.from(computeVipIds((overview as ClientOverviewRow[] | null) ?? []));

  const canManage =
    membership.role === "owner" ||
    membership.role === "manager" ||
    membership.role === "receptionist";

  return (
    <ClientsManager
      slug={slug}
      salonId={membership.salon_id}
      initial={clients ?? []}
      lastVisit={lastVisit}
      vipIds={vipIds}
      canManage={canManage}
    />
  );
}
