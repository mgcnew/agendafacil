/**
 * Regras de cobrança do Asaas que não dependem de rede nem de banco — ficam
 * aqui para serem testadas (asaasBilling.test.ts). O cliente HTTP mora em
 * ./asaas (server-only) e o webhook em app/api/asaas/webhook.
 */

export type SubStatusUpdate = "active" | "past_due" | "canceled";

/**
 * Evento de COBRANÇA do Asaas → status interno da assinatura.
 *
 * PAYMENT_DELETED fica de fora de propósito: o próprio Asaas apaga as
 * cobranças pendentes quando a assinatura é cancelada, e tratar isso como
 * "cancelado agora" cortava o acesso que a pessoa já tinha pago.
 */
export function statusForPaymentEvent(event?: string): SubStatusUpdate | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "active";
    case "PAYMENT_OVERDUE":
      return "past_due";
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return "canceled";
    default:
      return null;
  }
}

/** Eventos de ASSINATURA que significam que ela não cobra mais. */
export function isSubscriptionEndedEvent(event?: string): boolean {
  return event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED";
}

/**
 * Fim do período coberto por uma cobrança paga. A mensalidade é paga
 * adiantada: a cobrança que vence em D cobre de D até D + 1 mês. Antes o
 * webhook gravava o próprio D, e a "próxima renovação" aparecia no passado.
 * Dia que não existe no mês seguinte (31/01) cai no último dia (28/02).
 *
 * Vale até 23:59:59 de Brasília desse dia (02:59:59Z do dia seguinte): a
 * data do Asaas é de calendário brasileiro, e meia-noite UTC aparecia na tela
 * como o dia anterior.
 */
export function periodEndFromDueDate(dueDate: string): string {
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  const lastDayNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDayNext), 23 + 3, 59, 59)).toISOString();
}

/** Mantém o maior fim de período — evento atrasado não pode encurtar o que já foi pago. */
export function laterPeriodEnd(current: string | null, next: string): string {
  if (!current) return next;
  return new Date(current) > new Date(next) ? current : next;
}

type PaymentLike = { status: string; dueDate: string; invoiceUrl: string | null };

/**
 * Cobrança que a pessoa deve pagar agora: a pendente ou vencida mais antiga.
 * Antes pegava a primeira da lista, que podia ser uma fatura já paga.
 */
export function pickPayablePayment<T extends PaymentLike>(payments: T[]): T | null {
  const open = payments.filter(
    (p) => (p.status === "PENDING" || p.status === "OVERDUE") && p.invoiceUrl,
  );
  if (!open.length) return null;
  return [...open].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];
}

/**
 * Primeira cobrança de uma assinatura nova: no fim do teste grátis ou do
 * período já pago (quem cancelou e volta não paga duas vezes o mesmo mês);
 * se ambos já passaram, amanhã. Formato YYYY-MM-DD, no fuso de Brasília.
 */
export function firstDueDate(
  trialEndsAt: string | null,
  periodEnd: string | null,
  now: Date = new Date(),
): string {
  const amanha = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidatos = [trialEndsAt, periodEnd]
    .filter((x): x is string => !!x)
    .map((x) => new Date(x))
    .filter((d) => d > now);
  const due = candidatos.length
    ? new Date(Math.max(...candidatos.map((d) => d.getTime())))
    : amanha;
  // Data de calendário em Brasília: o fim do período é 23:59 daqui, que em
  // UTC já é o dia seguinte.
  return due.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
