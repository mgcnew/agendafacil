import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { startOfTodayBR, startOfTomorrowBR, formatTime } from "@/lib/utils";
import { AgendaTV, type TVItem } from "./AgendaTV";

export const dynamic = "force-dynamic";

export default async function AgendaTVPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const salonId = membership.salon_id;
  const supabase = await createClient();

  const { data: todayAppts } = await supabase
    .from("appointments")
    .select("id, starts_at, status, clients(full_name), salon_members(display_name), appointment_services(name)")
    .eq("salon_id", salonId)
    .gte("starts_at", startOfTodayBR())
    .lt("starts_at", startOfTomorrowBR())
    .order("starts_at");

  const items: TVItem[] = (todayAppts ?? []).map((a) => {
    const svcs = (a.appointment_services as { name: string }[] | null) ?? [];
    return {
      id: a.id,
      starts_at: a.starts_at,
      time: formatTime(a.starts_at),
      client: (a.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
      prof: (a.salon_members as { display_name?: string } | null)?.display_name ?? "",
      status: a.status,
      services: svcs.map((s) => s.name),
    };
  });

  const niche = membership.salons.niche;
  const rawColor = membership.salons.color_theme;
  const colorAttr = (rawColor && rawColor !== "")
    ? rawColor
    : (niche === "barbearia" ? undefined : "a");

  return (
    <div data-niche={niche} data-color={colorAttr} className="min-h-screen bg-background text-foreground">
      <AgendaTV items={items} salonName={membership.salons.name} />
    </div>
  );
}
