import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { HoursManager } from "./HoursManager";

export const dynamic = "force-dynamic";

export default async function HorariosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const [{ data: pros }, { data: hours }] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, profiles(full_name)")
      .eq("salon_id", membership.salon_id)
      .eq("is_active", true)
      .order("created_at"),
    supabase.from("working_hours").select("*").eq("salon_id", membership.salon_id),
  ]);

  const proList = (pros ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? (p.profiles as { full_name?: string } | null)?.full_name ?? "—",
  }));

  return (
    <HoursManager salonId={membership.salon_id} pros={proList} initialHours={hours ?? []} />
  );
}
