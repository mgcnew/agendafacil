"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(s + "T12:00:00");

/**
 * Calendário inline com UI própria (substitui <input type="date">).
 * value/min no formato YYYY-MM-DD.
 */
export function Calendar({
  value,
  onChange,
  min,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
}) {
  const [view, setView] = React.useState(() => {
    const base = value ? parse(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();
  const todayStr = toStr(new Date());

  // offset para começar na segunda-feira
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shift(n: number) {
    setView(new Date(year, month + n, 1));
  }

  return (
    <div className={cn("rounded-[var(--radius)] border border-border bg-card p-3 select-none", className)}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="h-8 w-8 grid place-items-center rounded-[var(--radius)] hover:bg-muted transition"
          aria-label="Mês anterior"
        >
          <CaretLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize">{MONTHS[month]} {year}</span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="h-8 w-8 grid place-items-center rounded-[var(--radius)] hover:bg-muted transition"
          aria-label="Próximo mês"
        >
          <CaretRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11px] text-muted-foreground text-center py-1">{w}</span>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const ds = toStr(new Date(year, month, d));
          const disabled = !!min && ds < min;
          const isSel = ds === value;
          const isToday = ds === todayStr;
          return (
            <button
              key={ds}
              type="button"
              disabled={disabled}
              onClick={() => onChange(ds)}
              aria-pressed={isSel}
              className={cn(
                "h-9 rounded-[var(--radius)] text-sm flex items-center justify-center transition",
                disabled && "opacity-30 pointer-events-none",
                isSel
                  ? "bg-primary text-primary-foreground font-semibold"
                  : isToday
                    ? "font-semibold text-primary ring-1 ring-primary/40 hover:bg-muted"
                    : "hover:bg-muted",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
