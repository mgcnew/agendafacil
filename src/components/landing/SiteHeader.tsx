"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  List,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { LoginButton } from "@/components/auth/LoginButton";

const NAV_LINKS = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Ver demo", href: "#demo" },
  { label: "Planos", href: "#planos" },
];

/**
 * Header da landing com logo centralizada.
 * Desktop: nav à esquerda · logo no centro · "Entrar" à direita.
 * Mobile: hambúrguer à esquerda · logo no centro · (espaçador) — os links
 * e o "Entrar" vivem dentro do menu, mantendo a logo centrada.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // Auto-hide inteligente: some ao descer, reaparece ao subir.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (open || y < 80) {
        setHidden(false);
      } else if (y > lastY.current + 4) {
        setHidden(true); // descendo
      } else if (y < lastY.current - 4) {
        setHidden(false); // subindo
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <header
      style={{ transform: hidden ? "translateY(-110%)" : "translateY(0)" }}
      className="sticky top-0 z-40 md:px-4 md:pt-3 transition-transform duration-300 will-change-transform motion-reduce:transition-none"
    >
      {/* Barra: full-width no mobile, "ilha" flutuante no desktop */}
      <div className="mx-auto max-w-6xl bg-background/80 backdrop-blur-xl border-b border-border md:border md:rounded-xl md:shadow-card">
      <div className="px-5 h-16 flex items-center gap-4">
        {/* Esquerda — nav (desktop) / hambúrguer (mobile) */}
        <div className="flex-1 flex items-center">
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-foreground/65 hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            className="md:hidden grid place-items-center h-10 w-10 -ml-2 rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            {open ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
          </button>
        </div>

        {/* Centro — logo */}
        <Link
          href="/"
          aria-label="Zulan — página inicial"
          className="shrink-0 flex items-center"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/logo-landing.webp"
            alt="Zulan"
            width={1396}
            height={373}
            priority
            className="h-7 w-auto"
          />
        </Link>

        {/* Direita — "Entrar" (desktop) / espaçador (mobile, mantém logo central) */}
        <div className="flex-1 flex items-center justify-end">
          <span className="hidden md:inline-flex">
            <LoginButton />
          </span>
          <span className="md:hidden h-10 w-10" aria-hidden />
        </div>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="md:hidden border-t border-border">
          <nav className="px-5 py-2 flex flex-col">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3.5 text-sm font-medium text-foreground/80 hover:text-foreground border-b border-border"
              >
                {l.label}
              </a>
            ))}
            <div className="py-3">
              <LoginButton />
            </div>
          </nav>
        </div>
      )}
      </div>
    </header>
  );
}
