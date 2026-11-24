import "server-only";
import { pickPayablePayment } from "./asaasBilling";

/**
 * Cliente da API do Asaas (apenas servidor — nunca importar em código de cliente).
 * A chave fica em ASAAS_API_KEY (env, secreta). Base URL controla sandbox vs produção:
 *   sandbox    → https://api-sandbox.asaas.com/v3
 *   produção   → https://api.asaas.com/v3
 */
const BASE = process.env.ASAAS_BASE_URL ?? "https://api-sandbox.asaas.com/v3";

function authHeaders() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada");
  return { "Content-Type": "application/json", access_token: key };
}

/**
 * Erro da API. `userMessage` é o texto que o Asaas devolve para erros de
 * validação (em português, ex.: "O CPF/CNPJ informado é inválido.") — esse
 * pode ir para a tela. O resto (status, corpo cru) fica só no log.
 */
export class AsaasError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly userMessage: string | null,
    body: string,
  ) {
    super(`Asaas ${path} → ${status}: ${body}`);
  }
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    let userMessage: string | null = null;
    if (res.status === 400) {
      try {
        userMessage = (JSON.parse(body) as { errors?: { description?: string }[] }).errors?.[0]?.description ?? null;
      } catch {}
    }
    throw new AsaasError(res.status, path, userMessage, body);
  }
  return res.json() as Promise<T>;
}

/** Mensagem que pode ir para a tela; o detalhe técnico vai para o log do servidor. */
export function asaasErrorMessage(e: unknown, fallback: string): string {
  console.error("[asaas]", e);
  return e instanceof AsaasError && e.userMessage ? e.userMessage : fallback;
}

export type AsaasCustomer = { id: string };
export type AsaasSubscription = { id: string };

export async function asaasCreateCustomer(input: {
  name: string;
  email?: string | null;
  mobilePhone?: string | null;
  cpfCnpj?: string | null;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function asaasCreateSubscription(input: {
  customer: string;
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      billingType: "UNDEFINED", // cliente escolhe PIX/boleto/cartão na página do Asaas
      cycle: "MONTHLY",
      ...input,
    }),
  });
}

/** Atualiza o valor da assinatura (troca de plano). Reflete nas próximas cobranças. */
export async function asaasUpdateSubscription(
  subscriptionId: string,
  value: number,
): Promise<void> {
  await asaasFetch<unknown>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ value, updatePendingPayments: true }),
  });
}

/**
 * Cancela a assinatura no Asaas: param as cobranças futuras e o Asaas apaga as
 * pendentes. O que já foi pago continua pago. Assinatura que já não existe lá
 * (404) conta como cancelada.
 */
export async function asaasCancelSubscription(subscriptionId: string): Promise<void> {
  try {
    await asaasFetch<unknown>(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof AsaasError && e.status === 404) return;
    throw e;
  }
}

/** URL da página de pagamento (checkout hospedado) da cobrança que está em aberto. */
export async function asaasSubscriptionCheckoutUrl(
  subscriptionId: string,
): Promise<string | null> {
  const payments = await asaasListSubscriptionPayments(subscriptionId);
  return pickPayablePayment(payments)?.invoiceUrl ?? null;
}

export type AsaasPayment = {
  id: string;
  status: string;        // PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED | ...
  value: number;
  dueDate: string;       // YYYY-MM-DD
  paymentDate: string | null;
  invoiceUrl: string | null;
};

/** Lista as cobranças (faturas) de uma assinatura, mais recentes primeiro. */
export async function asaasListSubscriptionPayments(
  subscriptionId: string,
): Promise<AsaasPayment[]> {
  const data = await asaasFetch<{ data?: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments`,
  );
  return [...(data.data ?? [])].sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
}
