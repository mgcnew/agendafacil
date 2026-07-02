"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

/**
 * Carrossel dos avisos do Gestor: mostra 2 por vez no desktop e 1 no mobile,
 * com swipe nativo (scroll-snap) + setas e "bolinhas" de página. Some os
 * controles quando tudo cabe numa página só. Os cards vêm já renderizados
 * (server) e são só posicionados aqui — a interatividade fica isolada neste
 * client component.
 */
export function InsightsCarousel({ items }: { items: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const sync = () => {
    const el = trackRef.current;
    if (!el) return;
    setPages(Math.max(1, Math.round(el.scrollWidth / el.clientWidth)));
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const go = (p: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(pages - 1, p));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="mt-4">
      <div
        ref={trackRef}
        className="no-scrollbar flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth"
      >
        {items.map((item, i) => (
          <div key={i} className="snap-start shrink-0 basis-full sm:basis-[calc(50%-0.25rem)]">
            {item}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para a página ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === page ? "w-4 bg-primary" : "w-1.5 bg-primary/25 hover:bg-primary/40"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Aviso anterior"
              onClick={() => go(page - 1)}
              disabled={page <= 0}
              className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-primary hover:border-primary/40 disabled:opacity-40 disabled:pointer-events-none"
            >
              <CaretLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próximo aviso"
              onClick={() => go(page + 1)}
              disabled={page >= pages - 1}
              className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-primary hover:border-primary/40 disabled:opacity-40 disabled:pointer-events-none"
            >
              <CaretRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
