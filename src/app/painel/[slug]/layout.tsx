import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { PanelShell, type NavItem } from "./PanelShell";

export const dynamic = "force-dynamic";

const NAV: { item: NavItem; perms?: string[] }[] = [
  { item: { href: "", label: "Visão geral", icon: "House" } },
  { item: { href: "/agenda", label: "Agenda", icon: "CalendarDays" } },
  { item: { href: "/servicos", label: "Serviços", icon: "Sparkles" }, perms: ["services.manage"] },
  { item: { href: "/campanhas", label: "Campanhas", icon: "BadgePercent" }, perms: ["services.manage"] },
  { item: { href: "/equipe", label: "Equipe", icon: "UserRoundCog" }, perms: ["team.manage"] },
  { item: { href: "/clientes", label: "Clientes", icon: "UsersRound" }, perms: ["clients.view"] },
  { item: { href: "/pacotes", label: "Pacotes", icon: "Package" }, perms: ["packages.view"] },
  { item: { href: "/financeiro", label: "Caixa & Comissões", icon: "Banknote" }, perms: ["cash.view"] },
  { item: { href: "/estoque", label: "Estoque", icon: "Boxes" }, perms: ["inventory.view"] },
  // Horários virou tab dentro de Configurações; engrenagem aparece com qualquer perm relevante
  { item: { href: "/configuracoes", label: "Configurações", icon: "Settings" }, perms: ["salon.manage", "schedule.manage", "team.manage"] },
];

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const perms = await getEffectivePermissions(membership.salon_id, membership);

  const items = NAV.filter(
    (n) => !n.perms || n.perms.some((p) => perms.has(p)),
  ).map((n) => n.item);

  const colorTheme = (membership.salons.color_theme ?? "a") as string;

  return (
    <div
      data-niche={membership.salons.niche}
      data-color={colorTheme}
      className="min-h-full bg-background text-foreground"
    >
      <PanelShell
        salon={{ name: membership.salons.name, slug, niche: membership.salons.niche }}
        role={membership.role}
        items={items}
      >
        {children}
      </PanelShell>
    </div>
  );
}
