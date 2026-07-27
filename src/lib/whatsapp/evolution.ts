import "server-only";

/**
 * Cliente da Evolution API (v2) para gerenciar a instância de WhatsApp de cada
 * salão: criar, ler o QR code, checar o estado e desconectar.
 *
 * O ENVIO de mensagem não passa por aqui — quem envia é o worker da fila
 * (Edge Function send-whatsapp), pra que toda a camada anti-ban valha. Aqui
 * é só o ciclo de vida da conexão, acionado pelo painel.
 *
 * A chave da API nunca chega ao navegador: estas funções são server-only e as
 * rotas em /api/whatsapp fazem a ponte.
 */

const BASE_URL = process.env.EVOLUTION_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

/** Estado normalizado — a Evolution usa "open"/"close"/"connecting". */
export type ConnectionState = "connected" | "connecting" | "disconnected";

export type QrCode = {
  /** PNG em data-URI, pronto pra <img src>. */
  base64: string | null;
  /** Código de pareamento por número, alternativa a escanear. */
  pairingCode: string | null;
};

function assertConfigured(): { baseUrl: string; apiKey: string } {
  if (!BASE_URL || !API_KEY) {
    throw new Error("evolution_nao_configurada");
  }
  return { baseUrl: BASE_URL.replace(/\/$/, ""), apiKey: API_KEY };
}

async function call<T>(
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<T> {
  const { baseUrl, apiKey } = assertConfigured();

  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // O painel espera essa resposta em tempo real; sem timeout a tela trava.
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`evolution_http_${res.status}: ${text.slice(0, 200)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Nome da instância na Evolution. Derivado do slug do salão porque precisa ser
 * estável: é a chave que liga o registro no banco à sessão do WhatsApp lá.
 * Prefixo evita colisão com instâncias criadas à mão no servidor.
 */
export function instanceNameFor(slug: string): string {
  return `zulan_${slug.replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;
}

function normalizeState(raw: string | undefined): ConnectionState {
  if (raw === "open") return "connected";
  if (raw === "connecting") return "connecting";
  return "disconnected";
}

/**
 * Cria a instância. Idempotente na prática: se já existe, a Evolution devolve
 * 403/409 e nós seguimos em frente — o que importa é ter a instância de pé.
 */
export async function createInstance(instanceName: string): Promise<void> {
  try {
    await call("/instance/create", {
      method: "POST",
      body: {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    // "already in use" não é erro pro nosso fluxo.
    if (!/40[39]/.test(msg)) throw e;
  }
}

/** Gera/recupera o QR code pra parear o aparelho. */
export async function getQrCode(instanceName: string): Promise<QrCode> {
  const data = await call<{
    base64?: string;
    code?: string;
    pairingCode?: string;
  }>(`/instance/connect/${encodeURIComponent(instanceName)}`);

  return {
    base64: data.base64 ?? null,
    pairingCode: data.pairingCode ?? null,
  };
}

export async function getConnectionState(instanceName: string): Promise<ConnectionState> {
  try {
    const data = await call<{ instance?: { state?: string } }>(
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    );
    return normalizeState(data.instance?.state);
  } catch (e) {
    // Instância inexistente = desconectada, não é falha da aplicação.
    if (/40[34]/.test((e as Error).message)) return "disconnected";
    throw e;
  }
}

/** Desconecta o aparelho, mas mantém a instância (dá pra reparear depois). */
export async function logoutInstance(instanceName: string): Promise<void> {
  try {
    await call(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
  } catch (e) {
    if (!/40[34]/.test((e as Error).message)) throw e;
  }
}

/** Remove a instância por completo. Usado ao desativar o recurso no salão. */
export async function deleteInstance(instanceName: string): Promise<void> {
  try {
    await call(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
  } catch (e) {
    if (!/40[34]/.test((e as Error).message)) throw e;
  }
}
