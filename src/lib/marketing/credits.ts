import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthBR } from "@/lib/utils";

/**
 * Controle de créditos de imagens por IA.
 *
 * Plano Max inclui uma cota mensal (default 20) que zera a cada mês. Pacotes
 * adicionais comprados (+10) viram `addon_balance` e NÃO expiram.
 *
 * Resiliência: enquanto a migração `ai_credits` não foi aplicada, as queries
 * falham e caímos no modo "prévia" (ilimitado, sem cobrança) para não travar a
 * UI durante o desenvolvimento.
 */

export const DEFAULT_MONTHLY_QUOTA = 20;

export type Credits = {
  monthlyQuota: number;
  usedThisMonth: number;
  addonBalance: number;
  remaining: number;
  /** true = tabela ainda não existe; UI mostra que está em modo prévia */
  preview: boolean;
};

const PREVIEW: Credits = {
  monthlyQuota: DEFAULT_MONTHLY_QUOTA,
  usedThisMonth: 0,
  addonBalance: 0,
  remaining: DEFAULT_MONTHLY_QUOTA,
  preview: true,
};

function shape(row: {
  monthly_quota: number;
  used_this_month: number;
  addon_balance: number;
  cycle_month: string;
}): Credits {
  const month = currentMonthBR();
  // Vira o mês: se o ciclo gravado é antigo, o uso mensal conta como zerado.
  const used = row.cycle_month === month ? row.used_this_month : 0;
  const monthlyRemaining = Math.max(0, row.monthly_quota - used);
  return {
    monthlyQuota: row.monthly_quota,
    usedThisMonth: used,
    addonBalance: row.addon_balance,
    remaining: monthlyRemaining + row.addon_balance,
    preview: false,
  };
}

export async function getCredits(
  supabase: SupabaseClient,
  salonId: string,
): Promise<Credits> {
  const { data, error } = await supabase
    .from("ai_credits")
    .select("monthly_quota, used_this_month, addon_balance, cycle_month")
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error) return PREVIEW; // tabela inexistente / sem permissão → prévia
  if (!data) {
    return {
      monthlyQuota: DEFAULT_MONTHLY_QUOTA,
      usedThisMonth: 0,
      addonBalance: 0,
      remaining: DEFAULT_MONTHLY_QUOTA,
      preview: false,
    };
  }
  return shape(data);
}

/**
 * Consome 1 crédito (mensal primeiro, depois add-on). Retorna o novo saldo ou
 * um erro de "sem créditos". Em modo prévia (tabela ausente) não cobra nada.
 */
export async function consumeCredit(
  supabase: SupabaseClient,
  salonId: string,
): Promise<{ ok: true; credits: Credits } | { ok: false; reason: "no_credits" }> {
  const credits = await getCredits(supabase, salonId);
  if (credits.preview) return { ok: true, credits };
  if (credits.remaining <= 0) return { ok: false, reason: "no_credits" };

  const month = currentMonthBR();
  const monthlyRemaining = Math.max(0, credits.monthlyQuota - credits.usedThisMonth);

  const patch =
    monthlyRemaining > 0
      ? { used_this_month: credits.usedThisMonth + 1, cycle_month: month }
      : { addon_balance: credits.addonBalance - 1, cycle_month: month };

  const { error } = await supabase
    .from("ai_credits")
    .update(patch)
    .eq("salon_id", salonId);

  if (error) return { ok: false, reason: "no_credits" };
  return { ok: true, credits: await getCredits(supabase, salonId) };
}
