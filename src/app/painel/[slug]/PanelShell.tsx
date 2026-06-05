"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
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

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const href = base + it.href;
        const active = it.href === "" ? pathname === base : pathname === href || pathname.startsWith(href + "/");
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
            <Icon className="h-4.5 w-4.5" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card p-4">
        <Link href={base} className="flex items-center gap-2 font-display font-bold text-lg px-2 mb-6">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
            <Scissors className="h-4 w-4" />
          </span>
          AgendeFácil
        </Link>
        <div className="px-2 mb-5">
          <p className="font-display font-semibold truncate">{salon.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABEL[role] ?? role}</p>
        </div>
        {nav}
        <div className="mt-auto pt-4 space-y-1">
          <a
            href={`/${salon.slug}`}
            target="_blank"
            className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
          >
            <ExternalLink className="h-4.5 w-4.5" /> Ver página pública
          </a>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
          >
            <LogOut className="h-4.5 w-4.5" /> Sair
          </button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="flex-1 flex flex-col min-w-0">
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
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="relative w-72 bg-card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <span className="font-display font-bold">{salon.name}</span>
                <button onClick={() => setOpen(false)} className="p-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <div className="mt-auto pt-4 space-y-1">
                <a href={`/${salon.slug}`} target="_blank" className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted">
                  <ExternalLink className="h-4.5 w-4.5" /> Página pública
                </a>
                <button onClick={logout} className="w-full flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted">
                  <LogOut className="h-4.5 w-4.5" /> Sair
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 p-5 sm:p-8 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
