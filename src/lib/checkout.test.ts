import { describe, it, expect } from "vitest";
import { receitaNaoEntrouNoCaixa } from "./checkout";

/**
 * O `finalize_appointment` só lança a receita quando há caixa aberto E valor
 * positivo. Nos outros casos ele conclui o atendimento e devolve
 * `cash_recorded: false` — e por muito tempo ninguém leu esse retorno.
 */
describe("receitaNaoEntrouNoCaixa", () => {
  it("avisa quando concluiu com valor e o caixa estava fechado", () => {
    expect(receitaNaoEntrouNoCaixa({ cash_recorded: false, amount: 35 })).toBe(true);
  });

  it("cala quando a receita entrou", () => {
    expect(receitaNaoEntrouNoCaixa({ cash_recorded: true, amount: 35 })).toBe(false);
  });

  it("cala quando não havia nada a lançar — avisar seria ruído", () => {
    expect(receitaNaoEntrouNoCaixa({ cash_recorded: false, amount: 0 })).toBe(false);
  });

  // Atendimento cortesia, ou serviço "a combinar" que ficou sem preço: o
  // caixa está aberto, mas não há valor. Não é o mesmo problema.
  it("cala quando o valor vem ausente", () => {
    expect(receitaNaoEntrouNoCaixa({ cash_recorded: false })).toBe(false);
  });

  it("cala quando a resposta não traz o campo — versão antiga da função", () => {
    expect(receitaNaoEntrouNoCaixa({ amount: 35 })).toBe(false);
    expect(receitaNaoEntrouNoCaixa(null)).toBe(false);
  });

  // O RPC devolve numeric do Postgres, que chega como string no JSON.
  it("entende o valor em texto, como vem do banco", () => {
    expect(
      receitaNaoEntrouNoCaixa({ cash_recorded: false, amount: "35.00" as unknown as number }),
    ).toBe(true);
  });
});
