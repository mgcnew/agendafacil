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
  Menu,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";

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

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  /** Nav usado no drawer mobile (ícone + label) */
  const mobileNav = (
    <nav className="flex flex-col gap-1">
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
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

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
    <div className="flex min-h-screen">
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 h-14">
          <Link href={base} className="flex items-center gap-2 font-display font-bold">
            <Scissors className="h-5 w-5 text-primary" /> {salon.name}
          </Link>
          <button onClick={() => setOpen(true)} className="p-2">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Drawer mobile */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <aside className="relative w-72 bg-card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-display font-bold">{salon.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[role] ?? role}
                  </p>
                </div>
                <button onClick={() => setOpen(false)} className="p-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {mobileNav}
              <div className="mt-auto pt-4 space-y-1">
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
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
