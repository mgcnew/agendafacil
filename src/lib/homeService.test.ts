import { describe, it, expect } from "vitest";
import { homeServiceFee, regraTarifa } from "./homeService";

// Tarifa do exemplo real: R$ 5,00 o primeiro km, R$ 2,00 cada km adicional.
const t = { firstKmFee: 5, extraKmFee: 2 };

describe("homeServiceFee", () => {
  // Estes números vieram de rodar home_service_fee() no banco de produção.
  // Se o SQL e o TypeScript divergirem, é aqui que aparece.
  it("bate com a função do banco", () => {
    expect(homeServiceFee(0.8, t)).toBe(5);
    expect(homeServiceFee(1, t)).toBe(5);
    expect(homeServiceFee(4, t)).toBe(11);
    expect(homeServiceFee(4.2, t)).toBe(13);
    expect(homeServiceFee(6, t)).toBe(15);
    expect(homeServiceFee(9, t)).toBe(21);
    expect(homeServiceFee(12, t)).toBe(27);
  });

  it("sem distância não há taxa", () => {
    expect(homeServiceFee(null, t)).toBe(0);
    expect(homeServiceFee(undefined, t)).toBe(0);
    expect(homeServiceFee(0, t)).toBe(0);
  });

  it("não cobra por lixo digitado", () => {
    expect(homeServiceFee(NaN, t)).toBe(0);
    expect(homeServiceFee(-3, t)).toBe(0);
    expect(homeServiceFee(Infinity, t)).toBe(0);
  });

  it("tarifa zerada não cobra nada", () => {
    expect(homeServiceFee(10, { firstKmFee: 0, extraKmFee: 0 })).toBe(0);
  });

  it("não deixa centavo escapar no ponto flutuante", () => {
    expect(homeServiceFee(3, { firstKmFee: 5.1, extraKmFee: 2.2 })).toBe(9.5);
  });
});

describe("regraTarifa", () => {
  // Intl usa espaço não separável depois do "R$"; normalizo pra comparar o
  // texto, não o byte.
  const limpo = (s: string) => s.replace(/ /g, " ");

  it("escreve a regra do jeito que a cliente lê", () => {
    expect(limpo(regraTarifa(t))).toBe("R$ 5,00 o primeiro km + R$ 2,00 por km adicional");
  });
});
