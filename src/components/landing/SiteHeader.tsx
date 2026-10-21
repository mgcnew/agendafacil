"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import { LoginButton } from "@/components/auth/LoginButton";

// Âncoras: a home e a /barbearia usam os mesmos ids de seção de propósito,
// então o menu funciona igual nas duas sem precisar de variante por rota.
const NAV_LINKS = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Demonstração", href: "#demo" },
  { label: "Planos", href: "#planos" },
];

/**
 * Header da landing.
 * Desktop: logo à esquerda · links no centro · Entrar + Criar meu salão à direita.
 * Mobile: logo à esquerda · hambúrguer à direita; links e ações no menu.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const pathname = usePathname();

  // Troca de vertical, sempre visível: quem caiu na página do nicho errado
  // precisa de uma saída óbvia acima da dobra.
  const vertical =
    pathname === "/barbearia"
      ? { label: "Salões de beleza", href: "/" }
      : { label: "Barbearias", href: "/barbearia" };

  // Auto-hide: some ao descer, reaparece ao subir.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (open || y < 80) {
        setHidden(false);
      } else if (y > lastY.current + 4) {
        setHidden(true);
      } else if (y < lastY.current - 4) {
        setHidden(false);
      }
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  const links = [...NAV_LINKS, vertical];

  return (
    <header
      style={{ transform: hidden ? "translateY(-110%)" : "translateY(0)" }}
      className={[
        "sticky top-0 z-40 bg-background/90 backdrop-blur-md transition-[transform,border-color] duration-300 motion-reduce:transition-none border-b",
        scrolled || open ? "border-border" : "border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 lg:h-[4.5rem] flex items-center gap-6">
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
            className="h-7 w-auto mix-blend-multiply"
          />
        </Link>

        <nav aria-label="Seções" className="hidden lg:flex flex-1 justify-center items-center gap-8">
          {links.map((l) =>
            l.href.startsWith("#") ? (
              <a
                key={l.href}
                href={l.href}
                className="text-[0.95rem] font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="text-[0.95rem] font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto lg:ml-0 flex items-center gap-2">
          <span className="hidden lg:inline-flex">
            <LoginButton />
          </span>
          <Link href="/criar-salao" className="hidden sm:inline-flex zl-btn zl-btn-dark zl-btn-sm">
            Criar meu salão
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="menu-landing"
            className="lg:hidden grid place-items-center h-10 w-10 -mr-2 rounded-full text-foreground hover:bg-muted transition-colors"
          >
            {open ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="menu-landing" className="lg:hidden border-t border-border">
          <nav aria-label="Menu" className="mx-auto max-w-7xl px-5 sm:px-8 py-2 flex flex-col">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3.5 text-base font-medium text-foreground/80 hover:text-foreground border-b border-border"
              >
                {l.label}
              </a>
            ))}
            <div className="py-4 flex items-center gap-3">
              <LoginButton />
              <Link href="/criar-salao" className="zl-btn zl-btn-dark zl-btn-sm sm:hidden" onClick={() => setOpen(false)}>
                Criar meu salão
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
