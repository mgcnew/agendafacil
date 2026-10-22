"use client";

import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearStoredRefreshToken } from "@/lib/auth/persistentSession";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  House,
  Plus,
  CalendarDots,
  Clock,
  Sparkle,
  UserGear,
  Users,
  Money,
  Stack,
  Package,
  Gear,
  SealPercent,
  ChartBar,
  CreditCard,
  Megaphone,
  Images,
  ArrowCounterClockwise,
  DotsThree,
  X,
  SignOut,
  ShareNetwork,
  ShieldCheck,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";

// O formulário de novo agendamento (com as animações do modal) pesava em toda
// tela do painel, mesmo para quem nunca toca no botão. Agora o código só desce
// no primeiro clique.
const QuickAppointment = dynamic(
  () => import("@/components/QuickAppointment").then((m) => m.QuickAppointment),
  { ssr: false },
);

/** Páginas que viram os 3 atalhos principais da barra inferior (mobile) */
const PRIMARY_HREFS = ["", "/agenda", "/clientes"];

const ICONS = {
  House,
  CalendarDays: CalendarDots,
  Clock,
  Sparkles: Sparkle,
  UserRoundCog: UserGear,
  UsersRound: Users,
  Banknote: Money,
  Boxes: Stack,
  Package,
  Settings: Gear,
  BadgePercent: SealPercent,
  BarChart3: ChartBar,
  CreditCard,
  Megaphone,
  Images,
  Recover: ArrowCounterClockwise,
} as const;

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietária",
  manager: "Gerente",
  professional: "Profissional",
  receptionist: "Recepção",
};

/** Tooltip que aparece à direita do ícone no hover */
function Tip({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50",
        "whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5",
        "text-xs font-medium text-background shadow-lg",
        "opacity-0 scale-95 origin-left transition-all duration-150",
        "group-hover:opacity-100 group-hover:scale-100",
        "group-focus-visible:opacity-100 group-focus-visible:scale-100",
      )}
    >
      {label}
    </span>
  );
}

export type PanelAnnouncement = {
  id: string;
  message: string;
  kind: string;
  link_url: string | null;
  link_label: string | null;
};

const ANN_BANNER: Record<string, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

function AnnouncementBanner({ announcements }: { announcements: PanelAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("af-ann-dismissed") ?? "[]"));
    } catch {
      setDismissed([]);
    }
  }, []);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem("af-ann-dismissed", JSON.stringify(next)); } catch { /* ignore */ }
  }

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="px-4 pt-4 sm:px-6 lg:px-8 space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className={cn(
            "flex items-start gap-3 rounded-[var(--radius)] border p-3 text-sm",
            ANN_BANNER[a.kind] ?? ANN_BANNER.info,
          )}
        >
          <Megaphone className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span>{a.message}</span>
            {a.link_url && (
              <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="ml-2 font-semibold underline">
                {a.link_label || "Saiba mais"}
              </a>
            )}
          </div>
          <button onClick={() => dismiss(a.id)} aria-label="Dispensar" className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Atalho central de "Agendar" na barra inferior.
 *
 * Leva pra Agenda com ?novo=1, que é o gatilho que o AgendaManager já
 * escutava pra abrir o formulário — e ele limpa o parâmetro depois, então o
 * botão de voltar do navegador não reabre o modal.
 *
 * Elevado acima da barra de propósito: é o único item que não é navegação, e
 * o relevo é o que comunica isso sem precisar de rótulo diferente.
 */
/**
 * Botão central da barra. Fora da Agenda ele abre o formulário POR CIMA da
 * tela atual (`onOpen`); dentro da Agenda continua sendo link, porque lá o
 * formulário já existe e já sabe qual dia está sendo olhado — o modal global
 * abriria sempre em hoje, que é o dia errado pra quem está vendo a semana que
 * vem.
 */
function AgendarButton({ href, onOpen }: { href?: string; onOpen?: () => void }) {
  const conteudo = (
    <>
      <span
        className="-mt-5 grid h-12 w-12 place-items-center rounded-full shadow-lg transition active:scale-95"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <Plus className="h-6 w-6" weight="bold" />
      </span>
      <span className="text-[10px] font-semibold leading-none text-primary">Agendar</span>
    </>
  );
  const classe = "flex flex-col items-center justify-center gap-1";

  return href ? (
    <Link href={href} aria-label="Novo agendamento" className={classe}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} aria-label="Novo agendamento" className={classe}>
      {conteudo}
    </button>
  );
}

export function PanelShell({
  salon,
  role,
  groups,
  children,
  isPlatformAdmin = false,
  announcements = [],
  canCreateAppointment = false,
}: {
  salon: { id: string; name: string; slug: string; niche: string };
  role: string;
  groups: NavGroup[];
  children: React.ReactNode;
  isPlatformAdmin?: boolean;
  announcements?: PanelAnnouncement[];
  /** appointments.manage — sem ela o atalho de agendar não faz sentido. */
  canCreateAppointment?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [novoAgendamento, setNovoAgendamento] = useState(false);
  // Fica montado depois da primeira abertura: preserva a animação de saída e
  // as listas já buscadas.
  const [quickUsado, setQuickUsado] = useState(false);
  const base = `/painel/${salon.slug}`;
  const naAgenda = pathname === `${base}/agenda`;
  const fullBleed = naAgenda;

  // A tela "Mais" fecha no Esc e ao trocar de rota (link tocado lá dentro).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const allItems = groups.flatMap((g) => g.items);

  const isActive = (href: string) =>
    href === ""
      ? pathname === base
      : pathname === base + href || pathname.startsWith(base + href + "/");

  // 3 atalhos fixos na barra inferior mobile
  const primaryItems: NavItem[] = [];
  const usedHrefs = new Set<string>();
  for (const h of PRIMARY_HREFS) {
    const it = allItems.find((i) => i.href === h);
    if (it) { primaryItems.push(it); usedHrefs.add(it.href); }
  }
  for (const it of allItems) {
    if (primaryItems.length >= 3) break;
    if (!usedHrefs.has(it.href)) { primaryItems.push(it); usedHrefs.add(it.href); }
  }

  // Configurações vai pro rodapé fixo do sheet "Mais" (junto de Compartilhar/Sair).
  const settingsItem = allItems.find((it) => it.href === "/configuracoes");

  // Grupos do sheet "Mais" (exclui os já na barra primária e o Configurações,
  // que fica fixo no rodapé).
  const moreGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !usedHrefs.has(it.href) && it.href !== "/configuracoes") }))
    .filter((g) => g.items.length > 0);

  // Desktop: último grupo (Sistema/Configurações) fica no rodapé da sidebar
  const mainGroups = groups.length > 1 ? groups.slice(0, -1) : groups;
  const systemGroup = groups.length > 1 ? groups[groups.length - 1] : null;

  function sharePublic() {
    const url = `${window.location.origin}/${salon.slug}`;
    // Celular (https): menu nativo do sistema — WhatsApp, Instagram, copiar, etc.
    if (typeof navigator !== "undefined" && navigator.share && window.isSecureContext) {
      navigator
        .share({ title: salon.name, text: `Agende seu horário no ${salon.name} 💈`, url })
        .catch(() => { /* cancelado */ });
      return;
    }
    // Fallback universal (desktop ou http): abre o WhatsApp com o link pronto.
    const msg = `Agende seu horário no ${salon.name} 💈\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  async function logout() {
    const supabase = createClient();
    // Limpa o backup de sessão ANTES de sair, senão o SilentRestore reentraria.
    clearStoredRefreshToken();
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  // Item da sidebar desktop: só ícone + tooltip no lg (barra estreita), ícone +
  // rótulo a partir do xl. O ativo usa o tom da cor do salão, sem pílula cheia.
  // gap só no xl: na barra estreita o rótulo some, mas o gap-3 continuava
  // contando e empurrava o ícone 6px para fora do centro do quadrado.
  const itemBase =
    "group relative flex items-center justify-center xl:justify-start xl:gap-3 rounded-[0.7rem] h-10 w-10 xl:w-full xl:px-3 text-[0.9rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
  // Rótulo: no lg fica só para leitor de tela (antes era display:none, e o
  // ícone sozinho não tinha nome acessível); no xl aparece ao lado do ícone.
  const itemLabel = "sr-only xl:not-sr-only xl:truncate";
  const itemIdle = "text-foreground/65 hover:bg-muted hover:text-foreground";

  function NavLink({ it }: { it: NavItem }) {
    const href = base + it.href;
    const active = isActive(it.href);
    const Icon = ICONS[it.icon];
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          itemBase,
          active ? "bg-secondary text-foreground font-semibold" : itemIdle,
        )}
      >
        <Icon
          className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")}
          weight={active ? "fill" : "regular"}
        />
        <span className={itemLabel}>{it.label}</span>
        <span className="xl:hidden"><Tip label={it.label} /></span>
      </Link>
    );
  }

  /** Nav usado na sidebar desktop — grupos com rótulo (xl) ou divisor (lg) */
  const desktopNav = (
    <nav aria-label="Painel" className="pointer-events-auto flex flex-col items-center xl:items-stretch gap-0.5 w-full">
      {mainGroups.map((group, gi) => (
        <div key={group.label} className="flex flex-col items-center xl:items-stretch gap-0.5 w-full">
          {gi > 0 && <div className="w-6 h-px bg-border my-2 xl:hidden" />}
          {mainGroups.length > 1 && (
            <p className={cn("hidden xl:block px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground", gi > 0 ? "pt-5" : "pt-1")}>
              {group.label}
            </p>
          )}
          {group.items.map((it) => <NavLink key={it.href} it={it} />)}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* ── Sidebar desktop — ícones no lg, ícone + rótulo no xl ───────── */}
      <aside className="hidden lg:flex w-16 xl:w-60 shrink-0 flex-col items-center xl:items-stretch border-r border-border bg-card py-4 xl:px-3 gap-4 overflow-visible">
        {/* Marca + salão — nunca comprime (shrink-0) */}
        <Link
          href={base}
          className="group relative flex shrink-0 items-center xl:gap-3 rounded-[0.7rem] xl:px-1.5 xl:py-1 mb-2 hover:bg-muted transition-colors"
        >
          <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[0.7rem] bg-white ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="Zulan" className="h-full w-full object-cover" />
          </span>
          <span className="hidden xl:block min-w-0 leading-tight">
            <span className="block truncate font-display font-bold text-[0.95rem]">{salon.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{ROLE_LABEL[role] ?? role}</span>
          </span>
          <span className="xl:hidden"><Tip label={salon.name} /></span>
        </Link>

        {/* Itens de navegação — rolagem interna invisível quando não cabem.
            box-content + pr/-mr estende a área de recorte só à direita (sem
            deslocar layout) para as tooltips do lg não serem cortadas; a barra
            some via .no-scrollbar e pointer-events-none deixa cliques passarem
            pro conteúdo (os links reativam com pointer-events-auto). */}
        <div className="flex-1 min-h-0 w-full box-content xl:box-border overflow-y-auto overscroll-contain no-scrollbar pointer-events-none pr-28 -mr-28 xl:pr-0 xl:mr-0">
          {desktopNav}
        </div>

        {/* Rodapé: Sistema (ex: Configurações) + ações utilitárias */}
        <div className="shrink-0 flex flex-col items-center xl:items-stretch gap-0.5 border-t border-border pt-3">
          {systemGroup && systemGroup.items.map((it) => <NavLink key={it.href} it={it} />)}
          {isPlatformAdmin && (
            <Link href="/admin" className={cn(itemBase, itemIdle)}>
              <ShieldCheck className="h-[18px] w-[18px] shrink-0" />
              <span className={itemLabel}>Plataforma</span>
              <span className="xl:hidden"><Tip label="Plataforma" /></span>
            </Link>
          )}
          <button onClick={sharePublic} className={cn(itemBase, itemIdle)}>
            <ShareNetwork className="h-[18px] w-[18px] shrink-0" />
            <span className={itemLabel}>Compartilhar link</span>
            <span className="xl:hidden"><Tip label="Compartilhar link" /></span>
          </button>
          <div className="flex items-center justify-center xl:justify-between gap-1 xl:pl-1 flex-col xl:flex-row">
            <ThemeToggle className="rounded-[0.7rem] text-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
            <button
              onClick={logout}
              className={cn(itemBase, "xl:w-auto text-foreground/65 hover:bg-red-500/10 hover:text-red-600")}
            >
              <SignOut className="h-[18px] w-[18px] shrink-0" />
              <span className={itemLabel}>Sair</span>
              <span className="xl:hidden"><Tip label="Sair" /></span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Área principal ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile — marca à esquerda, alternar tema à direita.
            Cantos de baixo arredondados no mesmo raio da barra inferior: as
            duas passam a ser o mesmo par de superfícies, com a página entre
            elas. Curva para dentro, borda reta encostando na tela — igual
            embaixo, espelhado.
            Fica opaca de propósito: a barra de baixo é translúcida porque o
            conteúdo desliza por trás dela, e aqui nada passa. Vidro sem nada
            atrás é só efeito. */}
        <header className="lg:hidden shrink-0 relative z-20 flex items-center justify-between border-b border-border/60 bg-card px-4 h-14 rounded-b-2xl shadow-[0_6px_24px_-10px_rgba(0,0,0,0.28)]">
          <Link href={base} className="flex items-center gap-2.5 font-display font-bold min-w-0">
            <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-[var(--radius)] bg-white ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="Zulan" className="h-full w-full object-cover" />
            </span>
            <span className="truncate">{salon.name}</span>
          </Link>
          <ThemeToggle className="-mr-2" />
        </header>

        {/* overscroll-contain: o scroll desta área não encadeia no documento
            quando chega ao fim. Sem isso, terminar de rolar a página puxava
            junto o que estivesse rolável atrás. */}
        <main className="flex-1 overflow-y-auto overscroll-contain flex flex-col max-lg:pb-[calc(4rem+env(safe-area-inset-bottom))]">
          <AnnouncementBanner announcements={announcements} />
          <div
            className={cn(
              "w-full",
              fullBleed
                // No celular a agenda flui como qualquer página (a página rola);
                // só no ≥sm ela trava na altura da viewport (grade com scroll
                // interno, padrão de calendário no desktop).
                ? "sm:h-full p-3 sm:p-4"
                : "flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10 2xl:px-12",
            )}
          >
            {children}
          </div>
        </main>

        {/* ── Bottom navigation (mobile) — fixa na viewport, leve efeito vidro ───────── */}
        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/85 backdrop-blur-md rounded-t-2xl shadow-[0_-6px_24px_-10px_rgba(0,0,0,0.28)] pb-[env(safe-area-inset-bottom)]">
          {/* 5 colunas quando há atalho de agendar: os dois primeiros itens à
              esquerda, o botão elevado no centro e o resto à direita. Criar
              agendamento é a ação mais repetida do dia — deixá-la só dentro da
              Agenda obrigava a navegar até lá primeiro. */}
          <div className={cn("grid h-16", canCreateAppointment ? "grid-cols-5" : "grid-cols-4")}>
            {primaryItems.map((it, i) => {
              // Depois do 2º item entra o botão central.
              const inserirAgendar = canCreateAppointment && i === 2;
              const active = isActive(it.href);
              const Icon = ICONS[it.icon];
              const label = it.href === "" ? "Início" : it.label;
              const link = (
                <Link
                  key={it.href}
                  href={base + it.href}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center justify-center gap-1"
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full px-4 py-0.5 transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-[22px] w-[22px] shrink-0" weight={active ? "bold" : "regular"} />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] leading-none truncate max-w-full px-1 transition-colors",
                      active ? "font-semibold text-primary" : "font-medium text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );

              if (!inserirAgendar) return link;
              return (
                <Fragment key={`ag-${it.href}`}>
                  <AgendarButton
                    href={naAgenda ? `${base}/agenda?novo=1` : undefined}
                    onOpen={naAgenda ? undefined : () => { setQuickUsado(true); setNovoAgendamento(true); }}
                  />
                  {link}
                </Fragment>
              );
            })}
            <button
              onClick={() => setOpen(true)}
              className="flex flex-col items-center justify-center gap-1"
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full px-4 py-0.5 transition-colors",
                  open ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                <DotsThree className="h-[22px] w-[22px]" weight={open ? "bold" : "regular"} />
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none transition-colors",
                  open ? "font-semibold text-primary" : "font-medium text-muted-foreground",
                )}
              >
                Mais
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* ── Tela "Mais" (mobile) — página cheia em lista, entra pela direita ── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mais opções"
          className="lg:hidden fixed inset-0 z-50 flex flex-col bg-background zl-push"
        >
          <header className="shrink-0 flex items-center gap-2 h-14 px-2 border-b border-border bg-card">
            <button
              onClick={() => setOpen(false)}
              aria-label="Voltar"
              className="grid place-items-center h-10 w-10 rounded-full text-foreground hover:bg-muted transition"
            >
              <CaretLeft className="h-5 w-5" weight="bold" />
            </button>
            <h2 className="font-display font-bold text-lg">Mais</h2>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-6">
            {/* Salão */}
            <div className="flex items-center gap-3 rounded-[var(--radius)] bg-card border border-border p-3.5">
              <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-[0.7rem] bg-white ring-1 ring-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-192.png" alt="Zulan" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold leading-tight truncate">{salon.name}</p>
                <p className="text-sm text-muted-foreground">{ROLE_LABEL[role] ?? role}</p>
              </div>
              <button
                onClick={() => { setOpen(false); sharePublic(); }}
                aria-label="Compartilhar link de agendamento"
                className="grid place-items-center h-10 w-10 shrink-0 rounded-full bg-secondary text-primary transition active:scale-95"
              >
                <ShareNetwork className="h-5 w-5" />
              </button>
            </div>

            {moreGroups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </p>
                <ul className="overflow-hidden rounded-[var(--radius)] bg-card border border-border divide-y divide-border">
                  {group.items.map((it) => {
                    const active = isActive(it.href);
                    const Icon = ICONS[it.icon];
                    return (
                      <li key={it.href}>
                        <Link
                          href={base + it.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3.5 px-4 h-14 transition-colors active:bg-muted",
                            active && "bg-secondary",
                          )}
                        >
                          <Icon
                            className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-foreground/70")}
                            weight={active ? "fill" : "regular"}
                          />
                          <span className={cn("flex-1 text-[0.95rem]", active ? "font-semibold" : "font-medium")}>
                            {it.label}
                          </span>
                          <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {/* Sistema: ajustes, preferências e saída */}
            <ul className="overflow-hidden rounded-[var(--radius)] bg-card border border-border divide-y divide-border">
              {settingsItem && (
                <li>
                  <Link
                    href={base + settingsItem.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(settingsItem.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3.5 px-4 h-14 transition-colors active:bg-muted",
                      isActive(settingsItem.href) && "bg-secondary",
                    )}
                  >
                    <Gear className="h-5 w-5 shrink-0 text-foreground/70" />
                    <span className="flex-1 text-[0.95rem] font-medium">{settingsItem.label}</span>
                    <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )}
              {isPlatformAdmin && (
                <li>
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3.5 px-4 h-14 transition-colors active:bg-muted"
                  >
                    <ShieldCheck className="h-5 w-5 shrink-0 text-foreground/70" />
                    <span className="flex-1 text-[0.95rem] font-medium">Plataforma</span>
                    <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )}
              <li className="px-4 h-14 flex items-center">
                <ThemeToggle variant="row" className="w-full" />
              </li>
              <li>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3.5 px-4 h-14 text-left text-red-600 transition-colors active:bg-red-500/10"
                >
                  <SignOut className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-[0.95rem] font-medium">Sair</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Novo agendamento sem sair da tela. Fica no shell (e não em cada
          página) porque é justamente o ponto: a tela de baixo continua
          intacta. Só é montado quando o dono pode criar agendamento. */}
      {canCreateAppointment && quickUsado && (
        <QuickAppointment
          salonId={salon.id}
          open={novoAgendamento}
          onClose={() => setNovoAgendamento(false)}
        />
      )}
    </div>
  );
}
