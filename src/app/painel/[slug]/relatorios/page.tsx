import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/AccessDenied";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { currentMonthBR, monthRangeBR } from "@/lib/utils";
import { ReportsView, type ReportData, type Identidades } from "./ReportsView";

function prevCmes(cmes: string): string {
  const [y, m] = cmes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

export default async function RelatoriosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  await guardFeature(slug, "/relatorios");

  // Relatórios são restritos: dona sempre; demais só com permissão reports.view
  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (membership.role !== "owner" && !perms.has("reports.view")) {
    return <AccessDenied slug={slug} permissao="Visualizar relatórios" />;
  }

  const cmes = currentMonthBR();
  const { start, end } = monthRangeBR(cmes);
  const { start: prevStart, end: prevEnd } = monthRangeBR(prevCmes(cmes));

  const supabase = await createClient();
  // report_overview ainda não está no database.types.ts (função nova) — cast local.
  const [res, prevRes, { data: svcRows }, { data: memberRows }] = await Promise.all([
    supabase.rpc("report_overview" as never, {
      p_salon: membership.salon_id,
      p_from: start,
      p_to: end,
    } as never),
    supabase.rpc("report_overview" as never, {
      p_salon: membership.salon_id,
      p_from: prevStart,
      p_to: prevEnd,
    } as never),
    // Cor de cada serviço e de cada profissional: a mesma da Agenda. O relatório
    // devolve só o nome, então o casamento é por nome (o mesmo que ele usa).
    supabase.from("services").select("name, color").eq("salon_id", membership.salon_id),
    supabase
      .from("salon_members")
      .select("display_name, color, photo_url, profiles(full_name)")
      .eq("salon_id", membership.salon_id),
  ]);

  const identidades: Identidades = { servicos: {}, profissionais: {} };
  for (const s of svcRows ?? []) {
    if (s.color) identidades.servicos[s.name] = s.color;
  }
  for (const m of memberRows ?? []) {
    // Mesmo nome que o report_overview monta: display_name, senão o do perfil.
    const nome =
      m.display_name ?? (m.profiles as { full_name?: string | null } | null)?.full_name ?? "Profissional";
    identidades.profissionais[nome] = { cor: m.color, foto: m.photo_url };
  }
  const initial = (res.data ?? null) as ReportData | null;
  const initialPrev = (prevRes.data ?? null) as ReportData | null;

  return (
    <ReportsView
      salonId={membership.salon_id}
      salonName={membership.salons.name}
      slug={slug}
      initialCmes={cmes}
      initialData={initial}
      initialPrevData={initialPrev}
      initialTab={tab}
      identidades={identidades}
    />
  );
}
