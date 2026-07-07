"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * Painel do Gestor Zulan — move os avisos (sinais de agora da Agenda + resumo
 * narrado) pra trás de um ícone ao lado do sino, no lugar de ocuparem o corpo
 * do Dashboard. Assim a tela inicial fica limpa e nada de informação se perde:
 * o ícone acende uma bolinha quando há algo pra ver.
 *
 * Os blocos são Server Components passados como `children`: renderizam no
 * servidor a cada visita (sempre frescos, uma vez só por carga) e ficam
 * montados aqui — apenas escondidos por CSS quando fechado. A bolinha é
 * acesa por um MutationObserver que enxerga um marcador (`data-gestor-signal`)
 * que cada bloco emite quando tem conteúdo — então o indicador reflete
 * exatamente o que está lá dentro, sem refazer nenhuma busca no cliente.
 */
export function GestorPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hasSignal, setHasSignal] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora (mesmo padrão do sino de notificações).
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Fecha no Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // O conteúdo entra por streaming (Suspense); observamos o container e
  // acendemos a bolinha assim que qualquer bloco marca ter aviso — sem
  // recalcular nada no cliente nem refazer as buscas do servidor.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => setHasSignal(!!el.querySelector("[data-gestor-signal]"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Resumo do dia do Gestor Zulan"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center h-10 w-10 rounded-[var(--radius)] border border-border hover:bg-muted transition"
      >
        <Sparkle className="h-5 w-5" weight={hasSignal ? "fill" : "regular"} />
        {hasSignal && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary ring-2 ring-card" />
          </span>
        )}
      </button>

      {/* Mantido montado (escondido) pra o conteúdo transmitir e a bolinha
          refletir o estado real; só a visibilidade muda ao abrir/fechar. */}
      <div
        className={cn(
          "absolute right-0 mt-2 w-[min(26rem,calc(100vw-2rem))] z-50 rounded-[var(--radius)] border border-border bg-card shadow-xl overflow-hidden",
          !open && "hidden",
        )}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkle className="h-4 w-4 text-primary" weight="fill" /> Resumo do dia
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={contentRef} className="max-h-[min(32rem,70vh)] overflow-auto p-3 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}
