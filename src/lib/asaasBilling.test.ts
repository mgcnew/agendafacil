import { describe, it, expect } from "vitest";
import {
  firstDueDate,
  isSubscriptionEndedEvent,
  laterPeriodEnd,
  periodEndFromDueDate,
  pickPayablePayment,
  statusForPaymentEvent,
} from "./asaasBilling";

describe("statusForPaymentEvent", () => {
  it("pagamento confirmado ou recebido ativa", () => {
    expect(statusForPaymentEvent("PAYMENT_CONFIRMED")).toBe("active");
    expect(statusForPaymentEvent("PAYMENT_RECEIVED")).toBe("active");
  });

  it("vencido vira inadimplente; estorno e contestação cancelam", () => {
    expect(statusForPaymentEvent("PAYMENT_OVERDUE")).toBe("past_due");
    expect(statusForPaymentEvent("PAYMENT_REFUNDED")).toBe("canceled");
    expect(statusForPaymentEvent("PAYMENT_CHARGEBACK_REQUESTED")).toBe("canceled");
  });

  // O Asaas apaga as pendentes ao cancelar a assinatura: não pode cortar o
  // período que a pessoa já pagou.
  it("cobrança apagada não mexe no status", () => {
    expect(statusForPaymentEvent("PAYMENT_DELETED")).toBeNull();
  });

  it("eventos que não interessam são ignorados", () => {
    expect(statusForPaymentEvent("PAYMENT_CREATED")).toBeNull();
    expect(statusForPaymentEvent(undefined)).toBeNull();
  });
});

describe("isSubscriptionEndedEvent", () => {
  it("reconhece assinatura apagada ou inativada", () => {
    expect(isSubscriptionEndedEvent("SUBSCRIPTION_DELETED")).toBe(true);
    expect(isSubscriptionEndedEvent("SUBSCRIPTION_INACTIVATED")).toBe(true);
    expect(isSubscriptionEndedEvent("SUBSCRIPTION_UPDATED")).toBe(false);
  });
});

describe("periodEndFromDueDate", () => {
  // Fim do dia em Brasília (UTC-3), para a data da tela não voltar um dia.
  it("cobre um mês a partir do vencimento", () => {
    expect(periodEndFromDueDate("2026-11-10")).toBe("2026-12-11T02:59:59.000Z");
  });

  it("vira o ano", () => {
    expect(periodEndFromDueDate("2026-12-15")).toBe("2027-01-16T02:59:59.000Z");
  });

  it("dia que não existe no mês seguinte cai no último dia", () => {
    expect(periodEndFromDueDate("2027-01-31")).toBe("2027-03-01T02:59:59.000Z");
    expect(periodEndFromDueDate("2028-01-31")).toBe("2028-03-01T02:59:59.000Z");
  });
});

describe("laterPeriodEnd", () => {
  it("evento atrasado não encurta o período", () => {
    expect(laterPeriodEnd("2027-01-10T00:00:00.000Z", "2026-12-10T00:00:00.000Z")).toBe(
      "2027-01-10T00:00:00.000Z",
    );
    expect(laterPeriodEnd(null, "2026-12-10T00:00:00.000Z")).toBe("2026-12-10T00:00:00.000Z");
  });
});

describe("pickPayablePayment", () => {
  const p = (status: string, dueDate: string, invoiceUrl: string | null = "u-" + dueDate) => ({
    status,
    dueDate,
    invoiceUrl,
  });

  it("ignora fatura paga e pega a aberta mais antiga", () => {
    const got = pickPayablePayment([
      p("RECEIVED", "2026-10-10"),
      p("PENDING", "2026-12-10"),
      p("OVERDUE", "2026-11-10"),
    ]);
    expect(got?.dueDate).toBe("2026-11-10");
  });

  it("sem fatura aberta, não devolve nada", () => {
    expect(pickPayablePayment([p("RECEIVED", "2026-10-10"), p("PENDING", "2026-11-10", null)])).toBeNull();
  });
});

describe("firstDueDate", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("no teste grátis, cobra no fim do teste", () => {
    expect(firstDueDate("2026-12-05T10:00:00Z", null, now)).toBe("2026-12-05");
  });

  it("quem cancelou e volta dentro do período pago só paga no fim dele", () => {
    expect(firstDueDate("2026-07-01T00:00:00Z", periodEndFromDueDate("2026-11-20"), now)).toBe("2026-12-20");
  });

  it("tudo vencido: amanhã", () => {
    expect(firstDueDate("2026-07-01T00:00:00Z", "2026-10-01T00:00:00Z", now)).toBe("2026-11-25");
    expect(firstDueDate(null, null, now)).toBe("2026-11-25");
  });
});
