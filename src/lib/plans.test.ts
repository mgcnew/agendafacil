import { describe, it, expect } from "vitest";
import {
  PLANS,
  SUBSCRIBABLE_PLANS,
  featuresLostDowngrading,
  parsePlanParam,
  planAllowsHref,
  planRank,
  priceLabel,
} from "./plans";

describe("planos — catálogo", () => {
  it("tem os três planos com os valores esperados", () => {
    expect(PLANS.basic.value).toBe(39.9);
    expect(PLANS.pro.value).toBe(69.9);
    expect(PLANS.max.value).toBe(99.9);
  });

  it("SUBSCRIBABLE_PLANS exclui os 'em breve' (max)", () => {
    const ids = SUBSCRIBABLE_PLANS.map((p) => p.id);
    expect(ids).toContain("basic");
    expect(ids).toContain("pro");
    expect(ids).not.toContain("max");
  });
});

describe("planRank", () => {
  it("ordena basic < pro < max", () => {
    expect(planRank("basic")).toBeLessThan(planRank("pro"));
    expect(planRank("pro")).toBeLessThan(planRank("max"));
  });
});

describe("planAllowsHref — gating por plano", () => {
  it("plano nulo não libera nada", () => {
    expect(planAllowsHref(null, "/agenda")).toBe(false);
    expect(planAllowsHref(null, "/financeiro")).toBe(false);
  });

  it("Básico libera rotas comuns, mas bloqueia rotas PRO-only", () => {
    expect(planAllowsHref("basic", "/agenda")).toBe(true);
    expect(planAllowsHref("basic", "")).toBe(true);
    expect(planAllowsHref("basic", "/financeiro")).toBe(false);
    expect(planAllowsHref("basic", "/relatorios")).toBe(false);
    expect(planAllowsHref("basic", "/estoque")).toBe(false);
    expect(planAllowsHref("basic", "/campanhas")).toBe(false);
    expect(planAllowsHref("basic", "/pacotes")).toBe(false);
  });

  it("Pro libera as rotas PRO-only", () => {
    expect(planAllowsHref("pro", "/financeiro")).toBe(true);
    expect(planAllowsHref("pro", "/relatorios")).toBe(true);
    expect(planAllowsHref("pro", "/estoque")).toBe(true);
  });

  it("Max libera tudo que o Pro libera", () => {
    expect(planAllowsHref("max", "/financeiro")).toBe(true);
    expect(planAllowsHref("max", "/agenda")).toBe(true);
  });
});

describe("parsePlanParam — plano vindo da URL", () => {
  it("aceita os planos assináveis", () => {
    expect(parsePlanParam("basic")).toBe("basic");
    expect(parsePlanParam("pro")).toBe("pro");
  });

  it("recusa plano 'em breve', que não pode virar destino de checkout", () => {
    expect(parsePlanParam("max")).toBeNull();
  });

  it("recusa vazio e valor inesperado", () => {
    expect(parsePlanParam(null)).toBeNull();
    expect(parsePlanParam("")).toBeNull();
    expect(parsePlanParam("gratuito")).toBeNull();
    expect(parsePlanParam("__proto__")).toBeNull();
  });
});

describe("featuresLostDowngrading — aviso de downgrade", () => {
  it("lista o que sai ao cair de Pro para Básico", () => {
    const perdidos = featuresLostDowngrading("pro", "basic");
    expect(perdidos).toContain("Caixa & Comissões");
    expect(perdidos).toContain("Relatórios");
    expect(perdidos).toContain("Estoque");
  });

  it("não avisa nada quando é upgrade ou mesmo plano", () => {
    expect(featuresLostDowngrading("basic", "pro")).toEqual([]);
    expect(featuresLostDowngrading("pro", "pro")).toEqual([]);
    expect(featuresLostDowngrading("basic", "basic")).toEqual([]);
  });

  it("usa rótulos legíveis, não caminhos de rota", () => {
    for (const item of featuresLostDowngrading("pro", "basic")) {
      expect(item.startsWith("/")).toBe(false);
    }
  });
});

describe("priceLabel", () => {
  it("formata em BRL", () => {
    const label = priceLabel(39.9);
    expect(label).toContain("R$");
    expect(label).toContain("39,90");
  });
});
