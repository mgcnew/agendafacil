import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type Salon = Tables<"salons">;
export type Member = Tables<"salon_members">;
export type Role = Enums<"member_role">;

export type MembershipWithSalon = Member & { salons: Salon };

/** Salões em que o usuário logado é membro ativo (com dados do salão). */
export async function getMyMemberships(): Promise<MembershipWithSalon[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("salon_members")
    .select("*, salons(*)")
    .eq("profile_id", user.id)
    .eq("is_active", true);

  return (data as MembershipWithSalon[] | null) ?? [];
}

/** Membership ativa de um salão específico (por slug) para o usuário logado. */
export async function getMembershipBySlug(
  slug: string,
): Promise<MembershipWithSalon | null> {
  const memberships = await getMyMemberships();
  return memberships.find((m) => m.salons?.slug === slug) ?? null;
}

/**
 * Conjunto de permissões efetivas do membro num salão.
 * Owner recebe todas. Demais: padrão do cargo + overrides do membro.
 */
export async function getEffectivePermissions(
  salonId: string,
  member: Member,
): Promise<Set<string>> {
  const supabase = await createClient();

  const { data: allPerms } = await supabase.from("permissions").select("key");
  const keys = (allPerms ?? []).map((p) => p.key);

  if (member.role === "owner") return new Set(keys);

  // 1) defaults globais do cargo  2) ajuste por cargo do salão  3) override por pessoa
  const [{ data: roleDefaults }, { data: salonRole }, { data: overrides }] = await Promise.all([
    supabase.from("role_permissions").select("permission_key, allowed").eq("role", member.role),
    supabase
      .from("salon_role_permissions")
      .select("permission_key, allowed")
      .eq("salon_id", salonId)
      .eq("role", member.role),
    supabase.from("member_permissions").select("permission_key, allowed").eq("member_id", member.id),
  ]);

  const effective = new Set<string>();
  for (const rd of roleDefaults ?? []) {
    if (rd.allowed) effective.add(rd.permission_key);
  }
  for (const sr of salonRole ?? []) {
    if (sr.allowed) effective.add(sr.permission_key);
    else effective.delete(sr.permission_key);
  }
  for (const ov of overrides ?? []) {
    if (ov.allowed) effective.add(ov.permission_key);
    else effective.delete(ov.permission_key);
  }
  return effective;
}
