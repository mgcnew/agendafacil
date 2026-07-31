"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/Calendar";
import { cn } from "@/lib/utils";
import { CalendarDots } from "@phosphor-icons/react/dist/ssr";

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-07-31" → Date ao meio-dia local (não deixa o fuso virar o dia). */
const parse = (s: string) => new Date(s + "T12:00:00");
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Escolha de dia em fita horizontal, com o calendário do mês guardado atrás de
 * um botão.
 *
 * O problema não era o calendário abrir para baixo — era ele ser o único jeito
 * de escolher o dia. Quase todo agendamento é para hoje, amanhã ou semana que
 * vem: obrigar a abrir um mês inteiro (que empurra horário, total e o botão
 * de criar para fora da tela) cobra três toques e uma rolagem por algo que
 * cabe em um.
 *
 * A fita mostra os próximos dias já visíveis — um toque, nada se mexe de
 * lugar. Para a data distante, o mês abre em popover por cima, como o Select
 * faz: sobrepõe em vez de empurrar, então o resto do formulário fica onde
 * estava.
 */
export function DateStrip({
  value,
  onChange,
  dias = 14,
  className,
}: {
  value: string;
  onChange: (d: string) => void;
  /** Quantos dias a fita oferece antes de exigir o calendário. */
  dias?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [theme, setTheme] = React.useState<{ niche?: string; color?: string }>({});
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const fitaRef = React.useRef<HTMLDivElement>(null);

  const hoje = React.useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  }, []);

  const lista = React.useMemo(() => {
    return Array.from({ length: dias }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() + i);
      return d;
    });
  }, [hoje, dias]);

  const selecionada = parse(value);
  const foraDaFita = !lista.some((d) => iso(d) === value);

  // Traz o dia escolhido para a vista — sem isso, reabrir o formulário numa
  // data adiante mostra a fita no começo e parece que nada está selecionado.
  //
  // Mexe no scrollLeft da própria fita em vez de `scrollIntoView`: aquele
  // rola QUALQUER ancestral que precise, e este componente vive dentro de um
  // modal que entra animando — bastaria o cálculo cair no meio da animação
  // para a tela inteira dar um pulo. Aqui nada fora da fita se move.
  React.useEffect(() => {
    const fita = fitaRef.current;
    const el = fita?.querySelector<HTMLElement>('[data-on="1"]');
    if (!fita || !el) return;
    const alvo = el.offsetLeft - (fita.clientWidth - el.offsetWidth) / 2;
    fita.scrollLeft = Math.max(0, alvo);
  }, [value]);

  const posicionar = React.useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [open, posicionar]);

  function abrir() {
    posicionar();
    const host = btnRef.current?.closest("[data-niche]") as HTMLElement | null;
    setTheme({ niche: host?.dataset.niche, color: host?.dataset.color });
    setOpen(true);
  }

  // O calendário é largo: alinha pela direita quando não cabe, e sobe quando
  // não há espaço embaixo.
  function popStyle(r: DOMRect): React.CSSProperties {
    const LARGURA = 300;
    const ALTURA = 340;
    const GAP = 6;
    const left = Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8));
    const paraCima = window.innerHeight - r.bottom < ALTURA && r.top > window.innerHeight - r.bottom;
    return paraCima
      ? { position: "fixed", bottom: window.innerHeight - r.top + GAP, left, width: LARGURA }
      : { position: "fixed", top: r.bottom + GAP, left, width: LARGURA };
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        {/* `min-w-0` é o que permite este filho encolher e rolar: sem ele o
            flex dimensiona pelo conteúdo e a fita empurra o botão do
            calendário para fora da tela em vez de rolar. */}
        <div className="relative min-w-0 flex-1">
          {/* `no-scrollbar` vem do globals.css, e não de uma variante
              utilitária: a regra global `*::-webkit-scrollbar` mora fora de
              @layer, e CSS sem layer vence CSS em layer independentemente da
              especificidade — a classe do Tailwind era gerada e perdia a
              cascata, deixando a barra de 10px à vista embaixo dos dias.

              `overscroll-x-contain` impede o swipe horizontal de vazar para a
              página (no iOS, arrastar até o fim vira gesto de voltar). */}
          <div
            ref={fitaRef}
            className="no-scrollbar flex gap-1.5 overflow-x-auto overscroll-x-contain"
          >
            {lista.map((d, i) => {
              const on = iso(d) === value;
              return (
                <button
                  key={iso(d)}
                  type="button"
                  data-on={on ? "1" : "0"}
                  onClick={() => onChange(iso(d))}
                  aria-pressed={on}
                  className={cn(
                    // Altura fixa, igual à do botão do calendário: sem isso
                    // cada um se dimensionava pelo próprio conteúdo e a fita
                    // ficava desalinhada do botão ao lado.
                    "shrink-0 w-14 h-14 flex flex-col items-center justify-center gap-px",
                    "rounded-[var(--radius)] border text-center transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {/* Sem tracking: "amanhã" é a palavra mais larga da fita, e
                      o espaçamento extra a fazia encostar nas bordas. */}
                  <span className={cn("text-[10px] uppercase leading-none", on ? "opacity-80" : "text-muted-foreground")}>
                    {i === 0 ? "hoje" : i === 1 ? "amanhã" : DIA_CURTO[d.getDay()]}
                  </span>
                  <span className="text-base font-semibold leading-none">{d.getDate()}</span>
                  <span className={cn("text-[10px] leading-none", on ? "opacity-80" : "text-muted-foreground")}>
                    {MES_CURTO[d.getMonth()]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Esmaece a borda direita: o dia cortado passa a ler como "tem mais
              para o lado" em vez de "o botão comeu o dia". Estático e sem JS —
              acompanhar a rolagem para escondê-lo no fim custaria um setState
              por quadro. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent" />
        </div>

        <button
          ref={btnRef}
          type="button"
          onClick={() => (open ? setOpen(false) : abrir())}
          aria-expanded={open}
          aria-label="Escolher outra data no calendário"
          className={cn(
            "shrink-0 grid h-14 w-11 place-items-center rounded-[var(--radius)] border transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            // Data fora da fita: o botão passa a carregar a seleção, senão
            // nada na tela mostraria que dia está escolhido.
            foraDaFita
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
          )}
        >
          <CalendarDots className="h-5 w-5" />
        </button>
      </div>

      {foraDaFita && (
        <p className="text-xs text-muted-foreground">
          {DIA_CURTO[selecionada.getDay()]}, {selecionada.getDate()} de{" "}
          {MES_CURTO[selecionada.getMonth()]} de {selecionada.getFullYear()}
        </p>
      )}

      {open && rect && createPortal(
        <div
          ref={popRef}
          data-niche={theme.niche}
          data-color={theme.color}
          style={popStyle(rect)}
          className="z-[70] rounded-[var(--radius)] border border-border bg-card p-2 shadow-xl text-foreground"
        >
          <Calendar
            value={value}
            onChange={(d) => { onChange(d); setOpen(false); }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
