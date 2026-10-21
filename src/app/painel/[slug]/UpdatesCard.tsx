"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Sparkle, X } from "@phosphor-icons/react/dist/ssr";

export type UnseenUpdate = { id: string; title: string; kind: string };

/**
 * "Saiu coisa nova" — uma vez, e some.
 *
 * A aba de Atualizações vive em Configurações, e ninguém abre Configurações
 * pra ler notícia: abre pra mudar alguma coisa. Sem um empurrão, o histórico
 * de entregas seria um museu que só o autor visita.
 *
 * O empurrão NÃO vai pro sino. Aquele é de agendamento — cancelamento,
 * lembrete, cliente que desmarcou — e a migração `whatsapp_sino_sem_conversa`
 * existe justamente porque encher o sino de coisa sem consequência operacional
 * enterra o que importa. Novidade de produto ali repetiria o erro.
 *
 * Dispensar é definitivo, e é assim de propósito: o card serve pra avisar uma
 * vez. Quem quiser ler de novo sabe onde fica, e quem não se importa não
 * merece ver isso toda segunda-feira.
 */
export function UpdatesCard({
  updates,
  slug,
}: {
  updates: UnseenUpdate[];
  slug: string;
}) {
  const [visivel, setVisivel] = useState(true);

  if (!visivel || updates.length === 0) return null;

  async function dispensar() {
    setVisivel(false);
    // Otimista sem volta atrás: se a chamada falhar, o pior que acontece é o
    // card reaparecer no próximo carregamento. Prender a tela esperando
    // resposta pra esconder um aviso seria pior que o defeito.
    await createClient().rpc("mark_product_updates_seen" as never);
  }

  // Uma linha só: a novidade avisa sem empurrar o dia pra baixo da dobra.
  const titulo = updates.length === 1 ? "Novidade no Zulan" : `${updates.length} novidades no Zulan`;

  return (
    <section
      aria-label={titulo}
      className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card py-2 pl-3 pr-1.5 text-sm"
    >
      <Sparkle aria-hidden className="h-4 w-4 shrink-0 text-primary" weight="fill" />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{titulo}:</span>{" "}
        <span className="text-muted-foreground">{updates.map((u) => u.title).join(" · ")}</span>
      </p>
      <Link
        href={`/painel/${slug}/configuracoes?tab=atualizacoes`}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        Ver <ArrowRight aria-hidden className="h-3 w-3" />
      </Link>
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar as novidades"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </section>
  );
}
