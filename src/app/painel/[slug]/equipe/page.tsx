import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { getAccessStatus } from "@/lib/subscription";
import { planAllowsHref } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

export default async function EquipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  // Aba Finanças (comissões) é conceito do Caixa & Comissões → só Pro/Max.
  const access = await getAccessStatus(slug);
  const canSeeFinance = planAllowsHref(access?.effective_plan ?? null, "/financeiro");

  const supabase = await createClient();
  const [{ data: members }, { data: permissions }, { data: roleDefaults }, { data: invites }, { data: services }, { data: profSvc }] =
    await Promise.all([
      supabase
        .from("salon_members")
        .select("*, profiles(full_name, email)")
        .eq("salon_id", membership.salon_id)
        .order("created_at"),
      supabase.from("permissions").select("*").order("category"),
      supabase.from("role_permissions").select("*"),
      supabase
        .from("salon_invites")
        .select("*")
        .eq("salon_id", membership.salon_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id, name, commission_percent")
        .eq("salon_id", membership.salon_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("professional_services")
        .select("member_id")
        .eq("salon_id", membership.salon_id),
    ]);

  const serviceCounts: Record<string, number> = {};
  for (const r of profSvc ?? []) {
    serviceCounts[r.member_id] = (serviceCounts[r.member_id] ?? 0) + 1;
  }

  return (
    <TeamManager
      salonId={membership.salon_id}
      myRole={membership.role}
      members={members ?? []}
      permissions={permissions ?? []}
      roleDefaults={roleDefaults ?? []}
      invites={invites ?? []}
      services={services ?? []}
      serviceCounts={serviceCounts}
      canSeeFinance={canSeeFinance}
    />
  );
}
