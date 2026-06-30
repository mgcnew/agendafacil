"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { refreshGestorInsights } from "./gestorActions";

export function RefreshGestorButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await refreshGestorInsights(slug);
          router.refresh();
        })
      }
      aria-label="Atualizar resumo da equipe"
      title="Atualizar resumo"
      className="shrink-0 grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary disabled:opacity-50"
    >
      <ArrowClockwise className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}
