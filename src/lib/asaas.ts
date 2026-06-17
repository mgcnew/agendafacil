import "server-only";

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

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
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

/** URL da página de pagamento (checkout hospedado) da primeira cobrança da assinatura. */
export async function asaasSubscriptionCheckoutUrl(
  subscriptionId: string,
): Promise<string | null> {
  const data = await asaasFetch<{ data?: { invoiceUrl?: string }[] }>(
    `/subscriptions/${subscriptionId}/payments`,
  );
  return data.data?.[0]?.invoiceUrl ?? null;
}
