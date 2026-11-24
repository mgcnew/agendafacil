"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * CTA fixo no rodapé (celular). Só aparece quando nenhum outro botão de
 * criar conta está na tela — antes ele ficava empilhado logo abaixo do botão
 * do topo, repetindo o mesmo convite. Começa escondido porque a página abre
 * com o botão do topo visível.
 */
export function StickyCTA({ href, children }: { href: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ctas = document.querySelectorAll('a[href^="/criar-salao"]:not([data-sticky-cta])');
    const naTela = new Set<Element>();
    // A faixa de baixo é onde a barra fica: botão escondido atrás dela não conta.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) naTela.add(e.target);
          else naTela.delete(e.target);
        }
        setVisible(naTela.size === 0);
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    ctas.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md p-3 sm:hidden",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        !visible && "translate-y-full",
      )}
    >
      <Link href={href} data-sticky-cta className="zl-btn zl-btn-dark w-full">
        {children} <ArrowRight className="h-4 w-4" weight="bold" />
      </Link>
    </div>
  );
}
