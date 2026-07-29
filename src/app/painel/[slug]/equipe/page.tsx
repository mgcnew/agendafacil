import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/AccessDenied";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
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

  // Esta página carrega e-mail de todos os colegas, convites pendentes e o
  // percentual de comissão de cada serviço. O menu já exigia team.manage pra
  // mostrar o link, mas a rota estava aberta: bastava digitar a URL. Esconder
  // link não é controle de acesso.
  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (!perms.has("team.manage")) {
    return <AccessDenied slug={slug} permissao="Gerenciar equipe e permissões" />;
  }

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
      salon={{
        name: membership.salons.name,
        phone: membership.salons.phone,
        address: membership.salons.address,
        logo_url: membership.salons.logo_url,
      }}
    />
  );
}
