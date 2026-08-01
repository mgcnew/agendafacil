"use client";

import { cn } from "@/lib/utils";

/**
 * Interruptor liga/desliga.
 *
 * O padrão estava copiado em sete telas como um `<button>` comum com uma
 * bolinha que anda — visualmente correto, e mudo: sem `role="switch"` o leitor
 * de tela anuncia "botão" e nada mais, então "aberto ou fechado", "envia ou
 * não envia", "atende em casa ou não" chegava como um botão sem estado.
 *
 * `label` é obrigatório porque o desenho não tem texto próprio: quem chama
 * passa o rótulo que está do lado, ou um que descreva o que liga.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Nome do controle para leitor de tela — descreva o que ele liga. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}
