import { describe, expect, it } from "vitest";
import { extractText, parseEvolutionWebhook } from "./inbound";

/** Envelope mínimo da Evolution, com o que o teste quiser por cima. */
function webhook(data: unknown, event = "messages.upsert", instance = "zulan_teste") {
  return { event, instance, data };
}

function msg(message: unknown, key: Record<string, unknown> = {}) {
  return {
    key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "ABC123", ...key },
    message,
  };
}

describe("extractText", () => {
  it("lê a mensagem de texto simples", () => {
    expect(extractText({ conversation: "SAIR" })).toBe("SAIR");
  });

  it("lê a mensagem com citação/formatação", () => {
    expect(extractText({ extendedTextMessage: { text: "Sim" } })).toBe("Sim");
  });

  it("desembrulha mensagem temporária", () => {
    expect(
      extractText({ ephemeralMessage: { message: { conversation: "não" } } }),
    ).toBe("não");
  });

  it("desembrulha visualização única", () => {
    expect(
      extractText({ viewOnceMessage: { message: { extendedTextMessage: { text: "ok" } } } }),
    ).toBe("ok");
  });

  it("lê o rótulo do botão tocado", () => {
    expect(
      extractText({ buttonsResponseMessage: { selectedDisplayText: "SIM" } }),
    ).toBe("SIM");
  });

  it("lê o título escolhido na lista", () => {
    expect(extractText({ listResponseMessage: { title: "Confirmar" } })).toBe("Confirmar");
  });

  it("devolve null pra mídia sem texto", () => {
    expect(extractText({ imageMessage: { url: "..." } })).toBeNull();
    expect(extractText({ audioMessage: { url: "..." } })).toBeNull();
    expect(extractText(undefined)).toBeNull();
  });
});

describe("parseEvolutionWebhook", () => {
  it("extrai telefone e texto de uma mensagem comum", () => {
    const { instance, messages } = parseEvolutionWebhook(
      webhook(msg({ conversation: "SAIR" })),
    );
    expect(instance).toBe("zulan_teste");
    expect(messages).toEqual([
      { phone: "5511987654321", text: "SAIR", providerMessageId: "ABC123" },
    ]);
  });

  it("aceita data como array", () => {
    const { messages } = parseEvolutionWebhook(
      webhook([msg({ conversation: "sim" }), msg({ conversation: "não" }, { id: "D2" })]),
    );
    expect(messages.map((m) => m.text)).toEqual(["sim", "não"]);
  });

  // A mais importante: o eco da nossa própria mensagem contém a palavra SAIR
  // (está no rodapé de todo template). Processar fromMe faria o salão tirar o
  // cliente da lista sozinho, a cada mensagem enviada.
  it("ignora o eco da mensagem que nós mesmos enviamos", () => {
    const { messages } = parseEvolutionWebhook(
      webhook(
        msg(
          { conversation: "Oi! _Responda SAIR para não receber mais mensagens._" },
          { fromMe: true },
        ),
      ),
    );
    expect(messages).toEqual([]);
  });

  it("ignora grupo e lista de transmissão", () => {
    for (const jid of ["120363000000000000@g.us", "status@broadcast"]) {
      const { messages } = parseEvolutionWebhook(
        webhook(msg({ conversation: "cancelar" }, { remoteJid: jid })),
      );
      expect(messages, jid).toEqual([]);
    }
  });

  it("tira o sufixo de aparelho do número", () => {
    const { messages } = parseEvolutionWebhook(
      webhook(msg({ conversation: "sim" }, { remoteJid: "5511987654321:12@s.whatsapp.net" })),
    );
    expect(messages[0].phone).toBe("5511987654321");
  });

  it("ignora texto vazio ou só espaço", () => {
    expect(parseEvolutionWebhook(webhook(msg({ conversation: "   " }))).messages).toEqual([]);
    expect(parseEvolutionWebhook(webhook(msg({ conversation: "" }))).messages).toEqual([]);
  });

  it("ignora evento que não é de mensagem", () => {
    const { messages } = parseEvolutionWebhook(
      webhook(msg({ conversation: "sim" }), "connection.update"),
    );
    expect(messages).toEqual([]);
  });

  it("não quebra com corpo inesperado", () => {
    for (const lixo of [null, undefined, "texto", 42, {}, { event: "messages.upsert" }]) {
      expect(() => parseEvolutionWebhook(lixo)).not.toThrow();
      expect(parseEvolutionWebhook(lixo).messages).toEqual([]);
    }
  });

  it("sobrevive a mensagem sem id (a dedupe é que fica de fora)", () => {
    const { messages } = parseEvolutionWebhook(
      webhook(msg({ conversation: "sim" }, { id: undefined })),
    );
    expect(messages[0].providerMessageId).toBeUndefined();
  });
});
