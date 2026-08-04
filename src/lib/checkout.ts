import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cobra um atendimento (finaliza + registra no caixa, com desconto/split).
 * Usado tanto pelo Caixa quanto pela Agenda — mesma função, mesmo
 * comportamento, pra não haver discrepância entre os dois fluxos de
 * fechamento.
 */
export type ResultadoCobranca = {
  stock_warnings?: string[];
  cash_recorded?: boolean;
  amount?: number;
};

/**
 * Finalizou o atendimento mas a receita NÃO entrou no caixa, porque não havia
 * caixa aberto na hora. O `finalize_appointment` sempre avisou isso no retorno
 * (`cash_recorded`), e ninguém lia: o atendimento saía como concluído, o
 * dinheiro não aparecia em lugar nenhum e a tela dizia que deu tudo certo.
 *
 * O valor zero não conta — aí não havia nada a lançar, e avisar seria ruído.
 */
export function receitaNaoEntrouNoCaixa(r: ResultadoCobranca | null): boolean {
  return r?.cash_recorded === false && Number(r?.amount ?? 0) > 0;
}

export async function chargeAppointment(
  supabase: SupabaseClient,
  appointmentId: string,
  payment: string,
  discount: number,
  splits?: { method: string; amount: number }[],
): Promise<ResultadoCobranca | null> {
  const params: Record<string, unknown> = {
    p_appointment: appointmentId,
    p_discount: discount || 0,
  };
  if (splits && splits.length > 1) {
    params.p_splits = splits;
  } else {
    params.p_payment_method = payment;
  }
  const { data, error } = await supabase.rpc("finalize_appointment" as never, params as never);
  if (error) throw error;
  return data as ResultadoCobranca | null;
}

/** Adiciona um serviço extra ao atendimento (soma no total_price; comissão é calculada normalmente ao finalizar). */
export async function addAppointmentService(
  supabase: SupabaseClient,
  appointmentId: string,
  serviceId: string,
): Promise<void> {
  const { error } = await supabase.rpc("add_appointment_service" as never, {
    p_appointment: appointmentId,
    p_service_id: serviceId,
  } as never);
  if (error) throw error;
}
