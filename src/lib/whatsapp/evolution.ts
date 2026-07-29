import "server-only";
import { SITE_URL } from "@/lib/siteUrl";

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
  /**
   * Código de 8 caracteres pra digitar no aparelho, alternativa a escanear.
   * Não é detalhe: quem abre o painel NO celular não consegue escanear um QR
   * exibido nesse mesmo celular — pra essa pessoa, é o único caminho.
   */
  pairingCode: string | null;
};

/** Erro da Evolution com o status HTTP preservado, pra decidir sem regex. */
export class EvolutionError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`evolution_http_${status}: ${detail.slice(0, 200)}`);
    this.name = "EvolutionError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    throw new EvolutionError(res.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Testa o status de verdade — antes era regex no texto todo, que casava com
 *  um "403" que aparecesse por acaso no corpo da resposta. */
function isStatus(e: unknown, ...codes: number[]): boolean {
  return e instanceof EvolutionError && codes.includes(e.status);
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
 * Cria a instância e devolve o QR que a própria resposta já traz.
 *
 * Devolver o QR daqui importa: a criação abre o socket do Baileys e é ela que
 * produz o primeiro código. Pedir de novo em `/instance/connect` logo depois
 * chega cedo demais, o socket ainda não emitiu nada e a resposta volta sem
 * base64 — que era exatamente por que a segunda instância "dava erro e não
 * conectava". Agora só se pede de novo se este aqui vier vazio.
 *
 * Idempotente: se a instância já existe, a Evolution devolve 403/409 e nós
 * seguimos — só sem QR, que o chamador busca com getQrCode.
 */
export async function createInstance(instanceName: string): Promise<QrCode | null> {
  try {
    const data = await call<{
      qrcode?: { base64?: string; pairingCode?: string };
    }>("/instance/create", {
      method: "POST",
      body: {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      },
    });

    const base64 = data.qrcode?.base64 ?? null;
    const pairingCode = data.qrcode?.pairingCode ?? null;
    return base64 || pairingCode ? { base64, pairingCode } : null;
  } catch (e) {
    // "already in use" não é erro pro nosso fluxo; o resto é.
    if (isStatus(e, 403, 409)) return null;
    throw e;
  }
}

/**
 * Recupera o QR de uma instância que já existe.
 *
 * Tenta mais de uma vez de propósito: o socket do Baileys leva um instante pra
 * emitir o código e a primeira resposta costuma vir vazia. Uma tentativa só
 * era a diferença entre conectar e ver "Não foi possível gerar o QR code".
 */
export async function getQrCode(instanceName: string, tentativas = 3): Promise<QrCode> {
  let ultimo: QrCode = { base64: null, pairingCode: null };

  for (let i = 0; i < tentativas; i++) {
    const data = await call<{
      base64?: string;
      code?: string;
      pairingCode?: string;
      instance?: { state?: string };
    }>(`/instance/connect/${encodeURIComponent(instanceName)}`);

    // Instância já pareada não emite QR — e insistir não vai mudar isso.
    if (normalizeState(data.instance?.state) === "connected") {
      throw new EvolutionError(409, "instancia_ja_conectada");
    }

    ultimo = { base64: data.base64 ?? null, pairingCode: data.pairingCode ?? null };
    if (ultimo.base64 || ultimo.pairingCode) return ultimo;

    if (i < tentativas - 1) await sleep(1500);
  }

  return ultimo;
}

/**
 * Aponta o webhook da instância pra nossa rota e assina só MESSAGES_UPSERT.
 *
 * O segredo viaja num header porque a Evolution não assina o corpo — sem isso
 * qualquer um que descobrisse a URL poderia forjar um "SAIR" ou um
 * cancelamento em nome de um cliente.
 *
 * Chamado a cada conexão de propósito: é idempotente, e assim uma instância
 * criada antes desta funcionalidade passa a receber ao reconectar.
 */
export async function setWebhook(instanceName: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_INBOUND_SECRET;
  // Sem segredo configurado, segue sem webhook: pior é não receber resposta,
  // não é quebrar a conexão que já funciona.
  if (!secret) return false;

  // A URL vem do mesmo lugar que o resto do site conhece, em vez de uma env
  // própria — uma variável a menos pra apontar pro ambiente errado.
  await call(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url: `${SITE_URL}/api/whatsapp/webhook`,
        headers: { "x-zulan-webhook-secret": secret },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    },
  });
  return true;
}

/**
 * Número que está pareado na instância, em E.164 sem o sufixo do jid.
 * Só serve pra mostrar no painel ("Conectado: 11 99999-9999") — é o que
 * confirma pro dono que ele parou o aparelho certo.
 */
export async function getConnectedNumber(instanceName: string): Promise<string | null> {
  try {
    const data = await call<
      Array<{ ownerJid?: string; number?: string }> | { ownerJid?: string; number?: string }
    >(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`);

    const inst = Array.isArray(data) ? data[0] : data;
    const jid = inst?.ownerJid ?? inst?.number;
    if (!jid) return null;
    return jid.split("@")[0].split(":")[0] || null;
  } catch {
    // Detalhe cosmético: nunca vale derrubar a checagem de status por causa
    // dele.
    return null;
  }
}

export async function getConnectionState(instanceName: string): Promise<ConnectionState> {
  try {
    const data = await call<{ instance?: { state?: string } }>(
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    );
    return normalizeState(data.instance?.state);
  } catch (e) {
    // Instância inexistente = desconectada, não é falha da aplicação.
    if (isStatus(e, 403, 404)) return "disconnected";
    throw e;
  }
}

/** Desconecta o aparelho, mas mantém a instância (dá pra reparear depois). */
export async function logoutInstance(instanceName: string): Promise<void> {
  try {
    await call(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
  } catch (e) {
    if (!isStatus(e, 403, 404)) throw e;
  }
}

/** Remove a instância por completo. Usado ao desativar o recurso no salão. */
export async function deleteInstance(instanceName: string): Promise<void> {
  try {
    await call(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
  } catch (e) {
    if (!isStatus(e, 403, 404)) throw e;
  }
}
