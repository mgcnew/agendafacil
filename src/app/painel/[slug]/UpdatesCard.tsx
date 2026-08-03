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

  return (
    <section
      aria-labelledby="novidades-titulo"
      className="relative rounded-[var(--radius)] border border-primary/25 bg-primary/5 p-4"
    >
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar as novidades"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>

      <h2 id="novidades-titulo" className="flex items-center gap-2 pr-8 text-sm font-semibold">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkle aria-hidden className="h-3.5 w-3.5" weight="fill" />
        </span>
        {updates.length === 1 ? "Tem novidade no Zulan" : `${updates.length} novidades no Zulan`}
      </h2>

      <ul className="mt-2 space-y-1 pl-9">
        {updates.map((u) => (
          <li key={u.id} className="text-sm text-foreground/80">
            {u.title}
          </li>
        ))}
      </ul>

      <Link
        href={`/painel/${slug}/configuracoes?tab=atualizacoes`}
        className="mt-2.5 ml-9 inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        Ver o que mudou <ArrowRight aria-hidden className="h-3 w-3" />
      </Link>
    </section>
  );
}
