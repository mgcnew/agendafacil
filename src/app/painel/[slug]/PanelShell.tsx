"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Sparkles,
  Users,
  Contact,
  Wallet,
  Boxes,
  Settings,
  Scissors,
  MoreHorizontal,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";

/** Páginas que viram os 3 atalhos principais da barra inferior (mobile) */
const PRIMARY_HREFS = ["", "/agenda", "/clientes"];

const ICONS = {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Sparkles,
  Users,
  Contact,
  Wallet,
  Boxes,
  Settings,
} as const;

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
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
  items,
  children,
}: {
  salon: { name: string; slug: string; niche: string };
  role: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = `/painel/${salon.slug}`;
  // Agenda (calendário) ocupa toda a largura; demais páginas usam largura padrão
  const fullBleed = pathname === `${base}/agenda`;

  const isActive = (href: string) =>
    href === ""
      ? pathname === base
      : pathname === base + href || pathname.startsWith(base + href + "/");

  // 3 atalhos principais (preferindo Início/Agenda/Clientes) + restante no "Mais"
  const primaryItems: NavItem[] = [];
  const usedHrefs = new Set<string>();
  for (const h of PRIMARY_HREFS) {
    const it = items.find((i) => i.href === h);
    if (it) { primaryItems.push(it); usedHrefs.add(it.href); }
  }
  for (const it of items) {
    if (primaryItems.length >= 3) break;
    if (!usedHrefs.has(it.href)) { primaryItems.push(it); usedHrefs.add(it.href); }
  }
  const moreItems = items.filter((i) => !usedHrefs.has(i.href));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  /** Nav usado na sidebar desktop (ícone centrado + tooltip) */
  const desktopNav = (
    <nav className="flex flex-col items-center gap-1 w-full">
      {items.map((it) => {
        const href = base + it.href;
        const active =
          it.href === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(href + "/");
        const Icon = ICONS[it.icon];
        return (
          <Link
            key={it.href}
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
      })}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden">
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

        {/* Ações do rodapé */}
        <div className="mt-auto flex flex-col items-center gap-1">
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
        <nav className="lg:hidden shrink-0 border-t border-border bg-card grid grid-cols-4 h-16">
          {primaryItems.map((it) => {
            const active = isActive(it.href);
            const Icon = ICONS[it.icon];
            const label = it.href === "" ? "Início" : it.label;
            return (
              <Link
                key={it.href}
                href={base + it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 transition",
              open ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
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

            {moreItems.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((it) => {
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
            )}

            <div className="border-t border-border mt-4 pt-3 space-y-1">
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
