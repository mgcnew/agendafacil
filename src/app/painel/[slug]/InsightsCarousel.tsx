"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

// Abaixo dessa largura por card, 2-por-página fica espremido — melhor 1 por vez.
const MIN_CARD_WIDTH = 260;
const GAP = 8; // px, equivale ao gap-2

/**
 * Carrossel dos avisos do Gestor: mostra 1 ou 2 cards por página, com swipe
 * nativo (scroll-snap) + setas e "bolinhas" de página. A decisão de 1 vs 2
 * usa a largura REAL do contêiner (ResizeObserver), não o tamanho da tela —
 * esse card pode ficar num espaço mais estreito que o viewport (ex.: coluna
 * do dashboard), e um breakpoint de viewport cortaria o 2º card sem dar
 * jeito de rolar até ele. Os cards vêm já renderizados (server) e são só
 * posicionados aqui — a interatividade fica isolada neste client component.
 */
export function InsightsCarousel({ items }: { items: ReactNode[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(1);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => setPerPage(el.clientWidth >= MIN_CARD_WIDTH * 2 + GAP ? 2 : 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil(items.length / perPage));

  useEffect(() => {
    // se perPage mudar (ex.: girar o celular) a página atual pode não existir mais
    setPage((p) => Math.min(p, pages - 1));
  }, [pages]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.clientWidth === 0) return;
      setPage(Math.round(el.scrollLeft / el.clientWidth));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const go = (p: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(pages - 1, p));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setPage(clamped);
  };

  return (
    <div ref={wrapperRef} className="mt-4">
      <div
        ref={trackRef}
        className="no-scrollbar flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth"
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="snap-start shrink-0"
            style={{ width: perPage === 2 ? `calc(50% - ${GAP / 2}px)` : "100%" }}
          >
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
