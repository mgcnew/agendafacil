import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { currentMonthBR, monthRangeBR } from "@/lib/utils";
import { ReportsView, type ReportData } from "./ReportsView";

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
    redirect(`/painel/${slug}`);
  }

  const cmes = currentMonthBR();
  const { start, end } = monthRangeBR(cmes);
  const { start: prevStart, end: prevEnd } = monthRangeBR(prevCmes(cmes));

  const supabase = await createClient();
  // report_overview ainda não está no database.types.ts (função nova) — cast local.
  const [res, prevRes] = await Promise.all([
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
  ]);
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
    />
  );
}
