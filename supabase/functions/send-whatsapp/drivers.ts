// Driver de envio de WhatsApp — camada de troca de provedor.
//
// Hoje: Evolution API (não-oficial, número próprio do salão via QR code).
// Depois: Meta Cloud API (oficial, template aprovado, risco de ban zero).
//
// O worker não sabe qual provedor está em uso: ele pede um driver e chama
// send(). Migrar é acrescentar um driver aqui e trocar WHATSAPP_DRIVER — o
// resto do sistema (fila, anti-ban, triggers, painel) não muda uma linha.

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  /** `fatal` marca erro que não adianta repetir (número inválido, sem WhatsApp). */
  | { ok: false; error: string; fatal?: boolean };

export type SendInput = {
  /** Instância na Evolution (1 por salão). Ignorado por provedores oficiais. */
  instanceName: string;
  /** E.164 sem "+" — ex.: 5511987654321 */
  phone: string;
  body: string;
};

export interface WhatsAppDriver {
  readonly name: string;
  send(input: SendInput): Promise<SendResult>;
}

// ── Evolution API ────────────────────────────────────────────────────────
class EvolutionDriver implements WhatsAppDriver {
  readonly name = "evolution";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async send({ instanceName, phone, body }: SendInput): Promise<SendResult> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instanceName)}`;

    // A Evolution pode travar se o WhatsApp estiver instável; sem timeout o
    // worker fica pendurado e a mensagem presa em 'sending'.
    const abort = AbortSignal.timeout(20_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apiKey },
        body: JSON.stringify({ number: phone, text: body }),
        signal: abort,
      });
    } catch (e) {
      return { ok: false, error: `network: ${(e as Error).message}` };
    }

    const text = await res.text();

    if (!res.ok) {
      // 400 costuma ser número que não existe no WhatsApp — repetir não
      // resolve e ainda queima reputação do número.
      const fatal = res.status === 400 || res.status === 404;
      return { ok: false, error: `http_${res.status}: ${text.slice(0, 300)}`, fatal };
    }

    try {
      const json = JSON.parse(text);
      return { ok: true, providerMessageId: json?.key?.id ?? null };
    } catch {
      return { ok: true, providerMessageId: null };
    }
  }
}

// ── Fábrica ──────────────────────────────────────────────────────────────
export function getDriver(): WhatsAppDriver {
  const driver = Deno.env.get("WHATSAPP_DRIVER") ?? "evolution";

  if (driver === "evolution") {
    const baseUrl = Deno.env.get("EVOLUTION_URL");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!baseUrl || !apiKey) throw new Error("evolution_env_missing");
    return new EvolutionDriver(baseUrl, apiKey);
  }

  throw new Error(`driver_desconhecido: ${driver}`);
}
