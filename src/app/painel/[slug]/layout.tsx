import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { PanelShell, type NavItem } from "./PanelShell";

export const dynamic = "force-dynamic";

const NAV: { item: NavItem; perm?: string }[] = [
  { item: { href: "", label: "Visão geral", icon: "LayoutDashboard" } },
  { item: { href: "/agenda", label: "Agenda", icon: "CalendarDays" } },
  { item: { href: "/servicos", label: "Serviços", icon: "Sparkles" }, perm: "services.manage" },
  { item: { href: "/equipe", label: "Equipe", icon: "Users" }, perm: "team.manage" },
  { item: { href: "/clientes", label: "Clientes", icon: "Contact" }, perm: "clients.view" },
  { item: { href: "/financeiro", label: "Caixa & Comissões", icon: "Wallet" }, perm: "cash.view" },
  { item: { href: "/estoque", label: "Estoque", icon: "Boxes" }, perm: "inventory.view" },
  { item: { href: "/configuracoes", label: "Configurações", icon: "Settings" }, perm: "salon.manage" },
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

  const items = NAV.filter((n) => !n.perm || perms.has(n.perm)).map(
    (n) => n.item,
  );

  return (
    <div data-theme={membership.salons.niche} className="min-h-full bg-background text-foreground">
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
