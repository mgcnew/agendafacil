"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { refreshGestorInsights } from "./gestorActions";

export function RefreshGestorButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const router = useRouter();

  // Some sozinho depois de um tempo — não precisa de outro clique pra fechar.
  useEffect(() => {
    if (!blockedMessage) return;
    const t = window.setTimeout(() => setBlockedMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [blockedMessage]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshGestorInsights(slug);
            if (result.blocked) {
              setBlockedMessage(result.message ?? null);
              return;
            }
            router.refresh();
          })
        }
        aria-label="Pedir para o Gestor analisar tudo de novo"
        title="O Gestor vai checar os avisos de novo agora"
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-card hover:text-primary disabled:opacity-50"
      >
        <MagnifyingGlass className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
        {pending ? "Analisando…" : "Analisar de novo"}
      </button>

      {blockedMessage && (
        <div
          role="status"
          className="af-rise absolute right-0 top-full z-10 mt-2 w-56 rounded-[var(--radius)] border border-border bg-card p-2.5 text-xs leading-snug text-muted-foreground shadow-md"
        >
          {blockedMessage}
        </div>
      )}
    </div>
  );
}
