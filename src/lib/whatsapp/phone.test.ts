import { describe, expect, it } from "vitest";
import { formatBrPhone, maskBrPhone, normalizeBrPhone, toStoredPhone } from "./phone";

describe("normalizeBrPhone", () => {
  it("aceita celular de 11 dígitos, com ou sem máscara", () => {
    for (const entrada of [
      "11987654321",
      "(11) 98765-4321",
      "11 98765 4321",
      "+55 11 98765-4321",
      "5511987654321",
    ]) {
      expect(normalizeBrPhone(entrada), entrada).toBe("5511987654321");
    }
  });

  // O 9º dígito é a maior fonte de erro: base antiga tem celular gravado sem
  // ele, e o WhatsApp só aceita com.
  it("acrescenta o nono dígito em celular antigo de 8 dígitos", () => {
    expect(normalizeBrPhone("1187654321")).toBe("5511987654321");
    expect(normalizeBrPhone("(11) 8765-4321")).toBe("5511987654321");
  });

  it("recusa fixo, que não tem WhatsApp", () => {
    expect(normalizeBrPhone("1132654321")).toBeNull(); // começa em 3
    expect(normalizeBrPhone("1122334455")).toBeNull(); // começa em 2
  });

  it("recusa DDD inválido", () => {
    expect(normalizeBrPhone("01987654321")).toBeNull();
    expect(normalizeBrPhone("10987654321")).toBeNull();
  });

  it("recusa comprimento fora do padrão", () => {
    for (const entrada of ["", "119876", "119876543210", "5511", "abc"]) {
      expect(normalizeBrPhone(entrada), entrada).toBeNull();
    }
  });

  it("recusa nulo e indefinido", () => {
    expect(normalizeBrPhone(null)).toBeNull();
    expect(normalizeBrPhone(undefined)).toBeNull();
  });
});

describe("formatBrPhone", () => {
  it("formata E.164 pra leitura", () => {
    expect(formatBrPhone("5511987654321")).toBe("(11) 98765-4321");
  });

  it("devolve como veio quando não reconhece", () => {
    expect(formatBrPhone("123")).toBe("123");
    expect(formatBrPhone(null)).toBeNull();
  });
});

describe("toStoredPhone", () => {
  it("grava no formato que a base já usa", () => {
    expect(toStoredPhone("11987654321")).toBe("+5511987654321");
    expect(toStoredPhone("(11) 98765-4321")).toBe("+5511987654321");
    expect(toStoredPhone("+55 11 98765-4321")).toBe("+5511987654321");
  });

  // O caso que criou o "+55" na base: o toE164 antigo montava "+55" + digits
  // sem olhar, então tudo isto virava cadastro que nunca recebe mensagem.
  it("recusa o que virava telefone fantasma", () => {
    expect(toStoredPhone("")).toBeNull();
    expect(toStoredPhone("   ")).toBeNull();
    expect(toStoredPhone("abc")).toBeNull();
    expect(toStoredPhone("11")).toBeNull();
    expect(toStoredPhone("1198765")).toBeNull();
    expect(toStoredPhone(null)).toBeNull();
  });

  it("recusa fixo, que não tem WhatsApp", () => {
    expect(toStoredPhone("1133334444")).toBeNull();
  });
});

describe("maskBrPhone", () => {
  it("formata enquanto digita", () => {
    expect(maskBrPhone("1")).toBe("1");
    expect(maskBrPhone("11")).toBe("11");
    expect(maskBrPhone("119")).toBe("(11) 9");
    expect(maskBrPhone("1198765")).toBe("(11) 9876-5");
    expect(maskBrPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("aceita colar com código do país ou já formatado", () => {
    expect(maskBrPhone("5511987654321")).toBe("(11) 98765-4321");
    expect(maskBrPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });

  it("não deixa passar do tamanho de um celular", () => {
    expect(maskBrPhone("119876543219999")).toBe("(11) 98765-4321");
  });
});
