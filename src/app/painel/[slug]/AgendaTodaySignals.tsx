import type { SupabaseClient } from "@supabase/supabase-js";
import { collectAgendaTodaySignals } from "@/lib/signals/agendaToday";
import { AgendaSignalsBanner } from "@/components/AgendaSignalsBanner";

/** Placeholder leve enquanto os sinais de hoje da Agenda carregam. */
export function AgendaTodaySignalsSkeleton() {
  return <div className="h-16 rounded-[var(--radius)] border border-border bg-muted/40 animate-pulse" />;
}

/**
 * Camada sempre-fresca (sem IA, sem cache) dos sinais "de agora" da Agenda no
 * Dashboard — mesma fonte/regra do banner da própria Agenda (ver
 * `src/lib/signals/agendaToday.ts` e `src/components/AgendaSignalsBanner.tsx`).
 * Fica atrás do próprio Suspense, separado do Gestor Zulan: nunca bloqueia o
 * resto da página e nunca depende da narração por IA (nem do cache dela) —
 * por isso o dono nunca mais vê "tudo bem" no Dashboard enquanto a Agenda
 * mostra um problema ao lado.
 */
export async function AgendaTodaySignalsAsync({
  supabase,
  salonId,
  slug,
}: {
  supabase: SupabaseClient;
  salonId: string;
  slug: string;
}) {
  const signals = await collectAgendaTodaySignals(supabase, salonId);
  return <AgendaSignalsBanner signals={signals} slug={slug} />;
}
