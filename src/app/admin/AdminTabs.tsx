"use client";

import { useEffect, useRef, useState } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

export type AdminTabDef<T extends string> = {
  id: T;
  label: string;
  icon: PhosphorIcon;
  /** Contagem que pede ação. Só aparece quando > 0. */
  badge?: number;
};

/** `scrollTo({behavior:'smooth'})` ignora o `scroll-behavior` do CSS — por
 *  isso a preferência do sistema precisa ser lida aqui, na mão. */
function suave(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/**
 * Navegação principal do painel da plataforma.
 *
 * São oito seções — mais do que cabe lado a lado num celular. Em vez de deixar
 * os rótulos se espremerem e quebrarem em duas linhas (era o que acontecia),
 * a trilha rola na horizontal e a aba escolhida se centraliza sozinha, então
 * dá pra ver que existe coisa dos dois lados.
 *
 * Teclado segue o padrão de abas: setas andam entre elas, Home/End vão às
 * pontas — e o Tab sai da trilha direto para o conteúdo, sem passar por oito
 * paradas no caminho (por isso só a aba ativa fica no fluxo de foco).
 */
export function AdminTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  ns = "",
  variant = "segmented",
}: {
  tabs: readonly AdminTabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** Prefixo dos ids, para dois tablists não colidirem na mesma página. */
  ns?: string;
  /**
   * `segmented` — trilha fechada, para a navegação principal.
   * `chips` — pastilhas soltas, para sub-navegação dentro de uma aba (o
   * desenho diferente é o que mostra que é um nível abaixo).
   */
  variant?: "segmented" | "chips";
}) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const botoes = useRef(new Map<T, HTMLButtonElement | null>());
  const [temMais, setTemMais] = useState(false);

  // Centraliza a aba ativa. `scrollLeft` na mão em vez de `scrollIntoView`:
  // este rola QUALQUER ancestral rolável, e levaria a página junto.
  useEffect(() => {
    const trilho = trilhoRef.current;
    const el = botoes.current.get(value);
    if (!trilho || !el) return;
    const alvo = el.offsetLeft - (trilho.clientWidth - el.offsetWidth) / 2;
    trilho.scrollTo({ left: Math.max(0, alvo), behavior: suave() });
  }, [value]);

  // A sombra da direita só existe enquanto há aba escondida. Sem isso ela
  // continuaria apagando a última aba depois de rolar até o fim.
  useEffect(() => {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const medir = () =>
      setTemMais(trilho.scrollLeft + trilho.clientWidth < trilho.scrollWidth - 4);
    medir();
    trilho.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(trilho);
    return () => {
      trilho.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === value);
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") alvo = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") alvo = 0;
    else if (e.key === "End") alvo = tabs.length - 1;
    else return;
    e.preventDefault();
    const proxima = tabs[alvo];
    onChange(proxima.id);
    // preventScroll: o efeito acima é quem posiciona a trilha; sem isso o
    // navegador também rolaria, e os dois brigariam.
    botoes.current.get(proxima.id)?.focus({ preventScroll: true });
  }

  const segmentado = variant === "segmented";

  return (
    <div
      className={
        segmentado
          // w-fit + max-w-full: a trilha abraça as abas quando cabem e vira
          // uma faixa rolável quando não cabem, sem sobrar espaço vazio.
          ? "relative w-fit max-w-full rounded-full border border-border bg-muted p-1"
          : "relative -mx-1"
      }
    >
      <div
        ref={trilhoRef}
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className={`no-scrollbar relative flex overflow-x-auto overscroll-x-contain scroll-smooth ${
          segmentado ? "gap-1" : "gap-1.5 px-1 py-1"
        }`}
      >
        {tabs.map(({ id, label: rotulo, icon: Icon, badge }) => {
          const ativa = id === value;
          return (
            <button
              key={id}
              ref={(el) => {
                botoes.current.set(id, el);
              }}
              type="button"
              role="tab"
              id={`aba-${ns}${id}`}
              aria-controls={`painel-${ns}${id}`}
              aria-selected={ativa}
              tabIndex={ativa ? 0 : -1}
              onClick={() => onChange(id)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 ${
                segmentado
                  ? `focus-visible:ring-offset-[var(--muted)] ${
                      ativa
                        ? "bg-card text-primary shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                    }`
                  : `focus-visible:ring-offset-[var(--background)] ${
                      ativa
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" weight={ativa ? "fill" : "regular"} />
              {rotulo}
              {badge !== undefined && badge > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-bold tabular-nums text-amber-800 ring-1 ring-amber-500/30">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dica de que há mais abas fora da vista. Nunca intercepta clique. */}
      {segmentado && temMais && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 right-1 w-8 rounded-r-full bg-gradient-to-l from-muted to-transparent"
        />
      )}
    </div>
  );
}

/** Conteúdo de uma aba, amarrado ao botão correspondente para leitores de tela. */
export function AdminTabPanel({
  id,
  ns = "",
  children,
}: {
  id: string;
  ns?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={`painel-${ns}${id}`} role="tabpanel" aria-labelledby={`aba-${ns}${id}`}>
      {children}
    </div>
  );
}
