/**
 * Leitura do webhook da Evolution.
 *
 * Fica separado da rota porque é a parte que quebra em silêncio: o dia que a
 * Evolution mudar o formato do envelope, o sintoma não é erro — é o cliente
 * respondendo SAIR e nada acontecer. Aqui dá pra testar cada formato sem
 * servidor, banco ou WhatsApp.
 *
 * Não interpreta nada: só diz "chegou este texto, deste número". Quem decide o
 * que fazer é `whatsapp_handle_inbound`, no banco.
 */

export type IncomingMessage = {
  /** Só dígitos, como veio do jid. A normalização BR acontece no banco. */
  phone: string;
  text: string;
  /** Id da Evolution — é o que garante não agir duas vezes na reentrega. */
  providerMessageId?: string;
};

type EvolutionKey = { remoteJid?: string; fromMe?: boolean; id?: string };
type EvolutionMessage = { key?: EvolutionKey; message?: Record<string, unknown> };

/**
 * O texto pode chegar em meia dúzia de formatos. Interessa exatamente uma
 * coisa: o que a pessoa digitou ou tocou.
 */
export function extractText(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null;

  // Mensagem temporária embrulha a real mais um nível.
  const efemera = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
  if (efemera?.message) return extractText(efemera.message);

  // Idem para a "view once".
  const umaVez = message.viewOnceMessage as { message?: Record<string, unknown> } | undefined;
  if (umaVez?.message) return extractText(umaVez.message);

  if (typeof message.conversation === "string") return message.conversation;

  const estendida = message.extendedTextMessage as { text?: string } | undefined;
  if (typeof estendida?.text === "string") return estendida.text;

  // Botão e lista: o que a pessoa "digitou" é o rótulo que ela tocou.
  const botao = message.buttonsResponseMessage as { selectedDisplayText?: string } | undefined;
  if (typeof botao?.selectedDisplayText === "string") return botao.selectedDisplayText;

  const lista = message.listResponseMessage as
    | { title?: string; singleSelectReply?: { selectedRowId?: string } }
    | undefined;
  if (typeof lista?.title === "string") return lista.title;

  const template = message.templateButtonReplyMessage as
    | { selectedDisplayText?: string }
    | undefined;
  if (typeof template?.selectedDisplayText === "string") return template.selectedDisplayText;

  // Áudio, imagem, figurinha, localização: não dá pra ler intenção. A rota
  // ignora, e o salão vê a mensagem no WhatsApp dele como sempre viu.
  return null;
}

/** Tira o sufixo de aparelho do jid: 5511999999999:12@s.whatsapp.net */
function phoneFromJid(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

/**
 * Devolve só as mensagens sobre as quais faz sentido agir. Descarta, nesta
 * ordem: evento que não é de mensagem, eco da própria mensagem enviada,
 * conversa que não é individual e mídia sem texto.
 */
export function parseEvolutionWebhook(payload: unknown): {
  instance: string | null;
  messages: IncomingMessage[];
} {
  if (!payload || typeof payload !== "object") return { instance: null, messages: [] };

  const { event, instance, data } = payload as {
    event?: string;
    instance?: string;
    data?: EvolutionMessage | EvolutionMessage[];
  };

  // Assinamos só MESSAGES_UPSERT, mas alguém pode mexer na config pelo painel
  // da Evolution e passar a mandar de tudo.
  if (event !== "messages.upsert" || !instance || !data) {
    return { instance: null, messages: [] };
  }

  const lista = Array.isArray(data) ? data : [data];
  const messages: IncomingMessage[] = [];

  for (const m of lista) {
    const jid = m?.key?.remoteJid;
    if (!jid) continue;

    // fromMe é o eco do que NÓS enviamos. Processar isso faria o salão
    // responder a si mesmo — e a palavra SAIR dentro do nosso próprio template
    // tiraria o cliente da lista sozinha.
    if (m.key?.fromMe) continue;

    // @g.us é grupo, @broadcast é lista de transmissão/status. Agir a partir de
    // um grupo deixaria qualquer participante cancelar horário dos outros.
    if (!jid.endsWith("@s.whatsapp.net")) continue;

    const text = extractText(m.message);
    if (!text || !text.trim()) continue;

    const phone = phoneFromJid(jid);
    if (!phone) continue;

    messages.push({ phone, text, providerMessageId: m.key?.id });
  }

  return { instance, messages };
}
