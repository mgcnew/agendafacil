"use client";

import { useEffect, useState } from "react";

/**
 * Revela um texto já pronto como se estivesse sendo digitado — só faz
 * sentido onde a demora já é real (ex.: resposta de IA atrás de Suspense).
 * Nunca usar para decorar dados que já carregam instantaneamente.
 *
 * Duração total sempre limitada (cap), independente do tamanho do texto —
 * isso aqui é encenação de um tempo que já existiu, não atraso novo.
 * Respeita prefers-reduced-motion (mostra o texto inteiro na hora).
 */
const MAX_DURATION_MS = 700;
const MIN_STEP_MS = 8;
const MAX_STEP_MS = 40;

export function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);
    if (!text) { setShown(""); setDone(true); return; }

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setShown(text); setDone(true); return; }

    const stepMs = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, MAX_DURATION_MS / text.length));
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, stepMs);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span className={className}>
      <span aria-hidden="true">
        {shown}
        {!done && <span className="inline-block w-[2px] h-[1em] -mb-[0.1em] ml-0.5 bg-current animate-pulse" />}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
