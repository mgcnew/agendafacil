"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { SignalKey } from "@/lib/signals/types";
import { dismissGestorSignal } from "./gestorActions";

/**
 * Envolve um card do Gestor e adiciona o "Entendido" (esconder por hoje) no
 * canto. Some na hora (otimista) e persiste a dispensa em segundo plano; na
 * virada do dia o aviso reaparece se a situação ainda existir. Quando a
 * categoria não é dispensável (signalKey nulo), só rende o card sem o botão.
 */
export function DismissibleCard({
  slug,
  signalKey,
  children,
}: {
  slug: string;
  signalKey: SignalKey | null;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (hidden) return null;

  return (
    <div className="relative h-full">
      {children}
      {signalKey && (
        <button
          type="button"
          aria-label="Entendido, esconder por hoje"
          title="Entendido — esconder por hoje"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setHidden(true);
            startTransition(async () => {
              await dismissGestorSignal(slug, signalKey);
              router.refresh();
            });
          }}
          className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-card hover:text-primary disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
