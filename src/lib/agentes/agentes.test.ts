import { describe, it, expect } from "vitest";
import { PLANS } from "@/lib/plans";
import { modulos, introPacote } from "./index";
import { moduloMd, pacoteMd, nomeArquivo } from "./markdown";
import { PAPEIS } from "./papeis";
import type { MetricasFato, PapelId } from "./index";

const SEM_PAGANTES: MetricasFato = {
  total: 5, active: 0, trialing: 2, past_due: 0, canceled: 0,
  mrr: 0, arpu: 0, conversion: 0, churn_30d: 0, new_this_month: 1,
};

const COM_PAGANTES: MetricasFato = {
  ...SEM_PAGANTES, active: 12, mrr: 780, arpu: 65, conversion: 30,
};

const PAPEIS_TODOS: PapelId[] = ["marketing", "comercial", "suporte", "manutencao"];

describe("pacote de módulos", () => {
  it("não repete nome de arquivo", () => {
    const nomes = modulos(SEM_PAGANTES).map((m) => nomeArquivo(m.arquivo));
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("gera nome de arquivo sem acento nem espaço", () => {
    for (const m of modulos(SEM_PAGANTES)) {
      expect(nomeArquivo(m.arquivo)).toMatch(/^[a-z0-9-]+\.md$/);
    }
  });

  it("todo módulo serve a pelo menos um papel", () => {
    for (const m of modulos(SEM_PAGANTES)) {
      expect(m.papeis.length).toBeGreaterThan(0);
    }
  });

  // As restrições valem para todo agente — é o único módulo que não admite
  // exceção. Um papel que não as recebe é um agente autorizado a inventar.
  it("as restrições vão para TODOS os papéis", () => {
    const restricoes = modulos(SEM_PAGANTES).find((m) => m.id === "restricoes");
    expect(restricoes).toBeDefined();
    for (const p of PAPEIS_TODOS) {
      expect(restricoes!.papeis).toContain(p);
    }
  });

  it("todo papel tem pelo menos um módulo", () => {
    const mods = modulos(SEM_PAGANTES);
    for (const p of PAPEIS_TODOS) {
      expect(mods.some((m) => m.papeis.includes(p))).toBe(true);
    }
  });

  // O mapa é montado a partir da lista justamente para não envelhecer quando
  // um módulo entra ou sai. Se alguém voltar a escrevê-lo à mão, isto quebra.
  it("o mapa do manifesto cobre todos os módulos", () => {
    const mods = modulos(SEM_PAGANTES);
    const mapa = mods[0].secoes.find((s) => s.id === "mapa");
    const tabela = mapa?.blocos.find((b) => b.tipo === "tabela");
    expect(tabela?.tipo).toBe("tabela");
    if (tabela?.tipo !== "tabela") return;
    expect(tabela.linhas).toHaveLength(mods.length);
    for (const m of mods) {
      expect(tabela.linhas.some((l) => l[0].includes(m.arquivo))).toBe(true);
    }
  });
});

describe("fatos gerados do sistema", () => {
  it("usa o preço do catálogo, não um número escrito à mão", () => {
    const fatos = modulos(SEM_PAGANTES).find((m) => m.id === "fatos")!;
    const md = moduloMd(fatos);
    for (const p of Object.values(PLANS)) {
      expect(md).toContain(p.name);
      // "R$ 39,90" — com espaço estreito, como o toLocaleString brasileiro emite.
      expect(md).toContain(p.value.toFixed(2).replace(".", ","));
    }
  });

  it("marca como não vendável o plano em breve", () => {
    const md = moduloMd(modulos(SEM_PAGANTES).find((m) => m.id === "fatos")!);
    expect(md).toMatch(/NÃO vendável/);
  });

  // O risco número um de um agente de marketing é inventar depoimento. Sem
  // nenhum pagante, o pacote precisa dizer isso com todas as letras.
  it("avisa que não há prova social quando não há pagante", () => {
    const md = moduloMd(modulos(SEM_PAGANTES).find((m) => m.id === "fatos")!);
    expect(md).toContain("Não há nenhum assinante pagante ainda");
  });

  it("troca o aviso quando já existe pagante", () => {
    const md = moduloMd(modulos(COM_PAGANTES).find((m) => m.id === "fatos")!);
    expect(md).not.toContain("Não há nenhum assinante pagante ainda");
    expect(md).toContain("12");
  });

  it("degrada com segurança quando o painel não responde", () => {
    const md = moduloMd(modulos(null).find((m) => m.id === "fatos")!);
    expect(md).toContain("[CONFIRMAR]");
  });

  it("carimba a data em que foi gerado", () => {
    const md = moduloMd(modulos(SEM_PAGANTES, new Date("2026-08-04T18:00:00")).find((m) => m.id === "fatos")!);
    expect(md).toContain("2026");
  });
});

describe("markdown", () => {
  it("emite títulos como hierarquia real", () => {
    const md = moduloMd(modulos(SEM_PAGANTES)[1]);
    expect(md).toMatch(/^# /m);
    expect(md).toMatch(/^## /m);
  });

  it("emite tabela em formato markdown válido", () => {
    const md = moduloMd(modulos(SEM_PAGANTES).find((m) => m.id === "fatos")!);
    expect(md).toMatch(/\| --- \|/);
  });

  it("o pacote único lista todos os módulos no sumário", () => {
    const mods = modulos(SEM_PAGANTES);
    const md = pacoteMd(mods, "Base", introPacote());
    for (const m of mods) expect(md).toContain(m.titulo);
  });
});

describe("papéis", () => {
  it("todo papel aponta para as restrições no prompt", () => {
    for (const p of PAPEIS) {
      expect(p.prompt).toContain("nunca-diga");
    }
  });

  it("todo papel define o formato da entrega", () => {
    for (const p of PAPEIS) {
      expect(p.contratoSaida.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("existe um papel para cada função prevista", () => {
    expect(PAPEIS.map((p) => p.id).sort()).toEqual([...PAPEIS_TODOS].sort());
  });
});
