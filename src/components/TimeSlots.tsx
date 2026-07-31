"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Grade de horários livres, agrupada por período do dia.
 *
 * Existia só na página pública: a cliente via os horários lado a lado e a
 * recepcionista, no painel, via um dropdown que mostrava um por vez. Escolher
 * horário é comparação — "tem alguma coisa depois das 15h?" se responde de
 * relance numa grade e exige abrir, rolar e fechar num select. Quem usa o
 * sistema o dia inteiro tinha a pior das duas telas.
 *
 * `dense` encolhe para o painel, onde a grade divide espaço com o resto do
 * formulário; a página pública continua com o toque generoso do celular.
 */
type Slot = { iso: string; hora: string };

export function TimeSlots({
  slots,
  selected,
  onSelect,
  dense = false,
  className,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (s: string) => void;
  dense?: boolean;
  className?: string;
}) {
  // Uma passada só, com o rótulo já formatado junto. O pai re-renderiza a cada
  // tecla digitada na busca de serviço, e `toLocaleTimeString` é caro o
  // bastante para não valer a pena chamá-lo duas vezes por horário a cada vez.
  const grupos = React.useMemo(() => {
    const manha: Slot[] = [], tarde: Slot[] = [], noite: Slot[] = [];
    for (const iso of slots) {
      const d = new Date(iso);
      const hora = d.toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
      });
      const item = { iso, hora };
      const h = parseInt(hora, 10);
      if (h < 12) manha.push(item);
      else if (h < 18) tarde.push(item);
      else noite.push(item);
    }
    return [
      { label: "Manhã", icon: "🌤", itens: manha },
      { label: "Tarde", icon: "☀️", itens: tarde },
      { label: "Noite", icon: "🌙", itens: noite },
    ].filter((g) => g.itens.length > 0);
  }, [slots]);

  return (
    <div className={cn(dense ? "space-y-2.5" : "space-y-4", className)}>
      {grupos.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {g.icon} {g.label}
          </p>
          <div className={cn("grid gap-2", dense ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4")}>
            {g.itens.map(({ iso, hora }) => {
              const on = selected === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelect(iso)}
                  aria-pressed={on}
                  className={cn(
                    // `transition` (e não `transition-all`) já limita às
                    // propriedades compostas pela GPU — cor, sombra e
                    // transform. Nada aqui anima largura ou altura, então a
                    // grade não reflui enquanto se escolhe.
                    "rounded-[var(--radius)] border text-sm font-medium transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    dense ? "h-9" : "h-11",
                    on
                      ? "bg-primary text-primary-foreground border-primary scale-[0.97]"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {hora}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
