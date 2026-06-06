import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
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

  const supabase = await createClient();
  const [{ data: members }, { data: permissions }, { data: roleDefaults }, { data: invites }] =
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
    ]);

  return (
    <TeamManager
      salonId={membership.salon_id}
      myRole={membership.role}
      members={members ?? []}
      permissions={permissions ?? []}
      roleDefaults={roleDefaults ?? []}
      invites={invites ?? []}
    />
  );
}
