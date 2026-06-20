"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  House,
  CalendarDays,
  Clock,
  Sparkles,
  UserRoundCog,
  UsersRound,
  Banknote,
  Boxes,
  Package,
  Settings,
  Scissors,
  BadgePercent,
  BarChart3,
  CreditCard,
  Megaphone,
  Images,
  Ellipsis,
  X,
  LogOut,
  ExternalLink,
  Share2,
} from "lucide-react";

/** Páginas que viram os 3 atalhos principais da barra inferior (mobile) */
const PRIMARY_HREFS = ["", "/agenda", "/clientes"];

const ICONS = {
  House,
  CalendarDays,
  Clock,
  Sparkles,
  UserRoundCog,
  UsersRound,
  Banknote,
  Boxes,
  Package,
  Settings,
  BadgePercent,
  BarChart3,
  CreditCard,
  Megaphone,
  Images,
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
      )}
    >
      {label}
    </span>
  );
}

export function PanelShell({
  salon,
  role,
  groups,
  children,
}: {
  salon: { name: string; slug: string; niche: string };
  role: string;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = `/painel/${salon.slug}`;
  const fullBleed = pathname === `${base}/agenda`;

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

  // Grupos do sheet "Mais" (exclui os itens já na barra primária)
  const moreGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !usedHrefs.has(it.href)) }))
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
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  function NavLink({ it }: { it: NavItem }) {
    const href = base + it.href;
    const active = isActive(it.href);
    const Icon = ICONS[it.icon];
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center justify-center rounded-[var(--radius)] w-10 h-10 transition",
          active
            ? "bg-primary text-primary-foreground"
            : "text-foreground/60 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <Tip label={it.label} />
      </Link>
    );
  }

  /** Nav usado na sidebar desktop — grupos com divisores */
  const desktopNav = (
    <nav className="flex flex-col items-center gap-1 w-full">
      {mainGroups.map((group, gi) => (
        <div key={group.label} className="flex flex-col items-center gap-1 w-full">
          {gi > 0 && <div className="w-6 h-px bg-border/60 my-1.5" />}
          {group.items.map((it) => <NavLink key={it.href} it={it} />)}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* ── Sidebar desktop — recolhida, ícones + tooltip ───────── */}
      <aside className="hidden lg:flex w-16 shrink-0 flex-col items-center border-r border-border bg-card py-4 gap-4 overflow-visible">
        {/* Logo */}
        <Link
          href={base}
          className="group relative flex items-center justify-center h-10 w-10 rounded-[var(--radius)] bg-primary text-primary-foreground mb-2"
        >
          <Scissors className="h-[18px] w-[18px]" />
          <Tip label={salon.name} />
        </Link>

        {/* Itens de navegação */}
        {desktopNav}

        {/* Rodapé: Sistema (ex: Configurações) + ações utilitárias */}
        <div className="mt-auto flex flex-col items-center gap-1">
          {systemGroup && (
            <>
              {systemGroup.items.map((it) => <NavLink key={it.href} it={it} />)}
              <div className="w-6 h-px bg-border/60 my-1.5" />
            </>
          )}
          <button
            onClick={sharePublic}
            className="group relative flex items-center justify-center rounded-[var(--radius)] w-10 h-10 text-primary hover:bg-primary/10 transition"
          >
            <Share2 className="h-[18px] w-[18px]" />
            <Tip label="Compartilhar link" />
          </button>
          <a
            href={`/${salon.slug}`}
            target="_blank"
            className="group relative flex items-center justify-center rounded-[var(--radius)] w-10 h-10 text-foreground/60 hover:bg-muted hover:text-foreground transition"
          >
            <ExternalLink className="h-[18px] w-[18px]" />
            <Tip label="Ver página pública" />
          </a>
          <button
            onClick={logout}
            className="group relative flex items-center justify-center rounded-[var(--radius)] w-10 h-10 text-foreground/60 hover:bg-muted hover:text-foreground transition"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <Tip label="Sair" />
          </button>
        </div>
      </aside>

      {/* ── Área principal ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile — apenas marca (sem hambúrguer) */}
        <header className="lg:hidden shrink-0 flex items-center border-b border-border bg-card px-4 h-14">
          <Link href={base} className="flex items-center gap-2 font-display font-bold">
            <Scissors className="h-5 w-5 text-primary" /> {salon.name}
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div
            className={cn(
              "w-full",
              fullBleed
                ? "h-full p-3 sm:p-4"
                : "px-4 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10 2xl:px-12",
            )}
          >
            {children}
          </div>
        </main>

        {/* ── Bottom navigation (mobile) ─────────────────────────── */}
        <nav className="lg:hidden shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 h-16">
            {primaryItems.map((it) => {
              const active = isActive(it.href);
              const Icon = ICONS[it.icon];
              const label = it.href === "" ? "Início" : it.label;
              return (
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
                    <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.4 : 2} />
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
                <Ellipsis className="h-[22px] w-[22px]" strokeWidth={open ? 2.4 : 2} />
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

      {/* ── Bottom sheet "Mais" (mobile) ─────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-card rounded-t-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[80vh] overflow-auto shadow-2xl">
            <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30 mb-4" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-display font-bold">{salon.name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[role] ?? role}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {moreGroups.length > 0 && (
              <div className="space-y-3">
                {moreGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {group.items.map((it) => {
                        const active = isActive(it.href);
                        const Icon = ICONS[it.icon];
                        return (
                          <Link
                            key={it.href}
                            href={base + it.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-[var(--radius)] border p-3 text-center transition",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:bg-muted text-foreground",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-[11px] font-medium leading-tight">{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border mt-4 pt-3 space-y-1">
              <button
                onClick={() => { setOpen(false); sharePublic(); }}
                className="w-full flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <Share2 className="h-4.5 w-4.5" /> Compartilhar link
              </button>
              <a
                href={`/${salon.slug}`}
                target="_blank"
                className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted"
              >
                <ExternalLink className="h-4.5 w-4.5" /> Página pública
              </a>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted"
              >
                <LogOut className="h-4.5 w-4.5" /> Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
