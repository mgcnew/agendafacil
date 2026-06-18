import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { getAccessStatus } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { SettingsTabs } from "./SettingsTabs";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
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

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  const canManageSalon = perms.has("salon.manage");
  const canManageSchedule = perms.has("schedule.manage");
  const canManageTeam = perms.has("team.manage");
  if (!canManageSalon && !canManageSchedule && !canManageTeam) redirect(`/painel/${slug}`);

  const supabase = await createClient();
  const [{ data: salon }, { data: pros }, { data: hours }, { data: permList }, { data: roleDefaults }, { data: salonRolePerms }, { data: ownerMember }] =
    await Promise.all([
      supabase.from("salons").select("*").eq("id", membership.salon_id).single(),
      supabase
        .from("salon_members")
        .select("id, display_name, profiles(full_name)")
        .eq("salon_id", membership.salon_id)
        .eq("is_active", true)
        .order("created_at"),
      supabase.from("working_hours").select("*").eq("salon_id", membership.salon_id),
      supabase.from("permissions").select("key, label, category").order("category"),
      supabase.from("role_permissions").select("role, permission_key, allowed"),
      supabase.from("salon_role_permissions").select("role, permission_key, allowed").eq("salon_id", membership.salon_id),
      supabase
        .from("salon_members")
        .select("id, display_name, profiles(full_name)")
        .eq("salon_id", membership.salon_id)
        .eq("role", "owner")
        .maybeSingle(),
    ]);

  if (!salon) redirect("/painel");

  const owner = ownerMember
    ? {
        id: ownerMember.id,
        display_name: ownerMember.display_name,
        full_name:
          (ownerMember.profiles as { full_name?: string } | null)?.full_name ?? null,
      }
    : null;

  const access = await getAccessStatus(slug);

  const proList = (pros ?? []).map((p) => ({
    id: p.id,
    name:
      p.display_name ??
      (p.profiles as { full_name?: string } | null)?.full_name ??
      "—",
  }));

  return (
    <SettingsTabs
      salon={salon}
      owner={owner}
      canEditSalon={membership.role === "owner"}
      canManageSalon={canManageSalon}
      canManageSchedule={canManageSchedule}
      canManageTeam={canManageTeam}
      pros={proList}
      initialHours={hours ?? []}
      initialTab={tab}
      permissions={permList ?? []}
      roleDefaults={roleDefaults ?? []}
      salonRolePerms={salonRolePerms ?? []}
      access={access}
    />
  );
}
