import { describe, it, expect } from "vitest";
import {
  PLANS,
  SUBSCRIBABLE_PLANS,
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

describe("priceLabel", () => {
  it("formata em BRL", () => {
    const label = priceLabel(39.9);
    expect(label).toContain("R$");
    expect(label).toContain("39,90");
  });
});
