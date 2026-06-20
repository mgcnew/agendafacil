import { redirect } from "next/navigation";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { getAccessStatus } from "@/lib/subscription";
import { planAllowsHref } from "@/lib/plans";
import { SubscriptionGate } from "./assinatura/SubscriptionGate";
import { PanelShell, type NavItem, type NavGroup } from "./PanelShell";

export const dynamic = "force-dynamic";

type NavDef = { item: NavItem; perms?: string[] };
type NavGroupDef = { label: string; items: NavDef[] };

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: "Operação",
    items: [
      { item: { href: "", label: "Visão geral", icon: "House" } },
      { item: { href: "/agenda", label: "Agenda", icon: "CalendarDays" } },
      { item: { href: "/clientes", label: "Clientes", icon: "UsersRound" }, perms: ["clients.view"] },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { item: { href: "/servicos", label: "Serviços", icon: "Sparkles" }, perms: ["services.manage"] },
      { item: { href: "/pacotes", label: "Pacotes", icon: "Package" }, perms: ["packages.view"] },
      { item: { href: "/estoque", label: "Estoque", icon: "Boxes" }, perms: ["inventory.view"] },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { item: { href: "/campanhas", label: "Campanhas", icon: "BadgePercent" }, perms: ["services.manage"] },
      { item: { href: "/marketing", label: "Divulgação", icon: "Megaphone" }, perms: ["services.manage"] },
      { item: { href: "/galeria", label: "Galeria", icon: "Images" }, perms: ["salon.manage"] },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { item: { href: "/equipe", label: "Equipe", icon: "UserRoundCog" }, perms: ["team.manage"] },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { item: { href: "/financeiro", label: "Caixa & Comissões", icon: "Banknote" }, perms: ["cash.view"] },
      { item: { href: "/relatorios", label: "Relatórios", icon: "BarChart3" }, perms: ["reports.view"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      // Horários virou tab dentro de Configurações
      { item: { href: "/configuracoes", label: "Configurações", icon: "Settings" }, perms: ["salon.manage", "schedule.manage", "team.manage"] },
    ],
  },
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

  // Gate de assinatura: bloqueia o painel se o trial venceu e não há assinatura ativa.
  // Fail-open: se o status não puder ser lido (RPC nulo), libera para não travar por engano.
  const access = await getAccessStatus(slug);
  if (access && !access.has_access) {
    return (
      <div
        data-niche={membership.salons.niche}
        data-color={(membership.salons.color_theme ?? "a") as string}
      >
        <SubscriptionGate
          slug={slug}
          salonName={membership.salons.name}
          access={access}
        />
      </div>
    );
  }

  // Filtra o menu por permissão e, quando o plano é conhecido, pelo tier do plano.
  // Fail-open: se effective_plan vier nulo, não filtra por plano (mostra tudo).
  const effectivePlan = access?.effective_plan ?? null;
  const groups: NavGroup[] = NAV_GROUPS
    .map((g) => ({
      label: g.label,
      items: g.items
        .filter((n) => !n.perms || n.perms.some((p) => perms.has(p)))
        .map((n) => n.item)
        .filter((it) => !effectivePlan || planAllowsHref(effectivePlan, it.href)),
    }))
    .filter((g) => g.items.length > 0);

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
        groups={groups}
      >
        {children}
      </PanelShell>
    </div>
  );
}
