"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * Alterna o modo noturno do painel. A preferência é por dispositivo
 * (localStorage "af-theme") e o atributo data-theme fica no <html> — o
 * script inline do layout do painel já aplica antes de pintar (sem flash).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    try {
      if (next) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("af-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("af-theme", "light");
      }
    } catch {
      /* ignore */
    }
  }

  const label = dark ? "Tema claro" : "Tema escuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center rounded-[var(--radius)] w-10 h-10 text-foreground/60 hover:bg-muted hover:text-foreground transition",
        className,
      )}
    >
      {mounted && dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
