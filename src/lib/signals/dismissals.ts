import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignalKey } from "./types";
import type { InsightType } from "@/lib/ai/dashboardInsights";

/**
 * "Dispensar até amanhã" dos avisos do Gestor.
 *
 * Cada categoria de aviso pode ser escondida pelo dono por hoje (data BR). Não
 * envolve IA — é puro código, coerente com a arquitetura de sinais. A data em
 * que foi dispensado mora em gestor_dismissals; na virada do dia o aviso
 * reaparece sozinho se a situação ainda existir (a data não bate mais).
 */

/** Data de hoje no fuso America/Sao_Paulo (YYYY-MM-DD), igual ao usado no cache. */
export function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * A categoria de dispensa de um insight é a sua "chave de sinal". Alguns tipos
 * de insight (revenue, general) não vêm de um sinal específico e não podem ser
 * dispensados — retornam null.
 */
export function signalKeyForInsight(type: InsightType): SignalKey | null {
  switch (type) {
    case "reactivation":
      return "reactivation";
    case "birthday":
      return "birthday_today";
    case "package_expiring":
      return "package_expiring";
    case "package_dormant":
      return "package_dormant";
    case "low_stock":
      return "low_stock";
    case "service_dormant":
      return "service_dormant";
    case "product_dormant":
      return "product_dormant";
    case "recent_no_shows":
      return "recent_no_shows";
    default:
      return null; // revenue, general — sem categoria dispensável
  }
}

/** Categorias que o dono dispensou HOJE (BR) para este salão. */
export async function getDismissedKeys(
  supabase: SupabaseClient,
  salonId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("gestor_dismissals")
    .select("signal_key")
    .eq("salon_id", salonId)
    .eq("dismissed_on", todayBR());
  return new Set((data ?? []).map((r) => (r as { signal_key: string }).signal_key));
}
