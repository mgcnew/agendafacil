import { describe, expect, it } from "vitest";
import { formatBrPhone, normalizeBrPhone } from "./phone";

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
