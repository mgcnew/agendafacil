import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
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

  // O menu já exigia clients.view; a rota estava aberta a quem digitasse a URL.
  // A ficha do cliente tem telefone, e-mail, aniversário e anamnese.
  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (!perms.has("clients.view")) redirect(`/painel/${slug}`);

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

  // Era a lista de cargos no código, que ignorava "Gerenciar clientes" em
  // Acessos: desligar lá não tirava os botões da tela. O RLS barrava no
  // salvamento, então virava erro em vez de campo bloqueado.
  const canManage = perms.has("clients.manage");

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
