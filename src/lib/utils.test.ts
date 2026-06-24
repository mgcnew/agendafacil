import { describe, it, expect, afterEach, vi } from "vitest";
import {
  formatBRL,
  waLink,
  formatServicePrice,
  formatDuration,
  todayInBR,
  startOfTodayBR,
  startOfTomorrowBR,
  currentMonthBR,
  monthRangeBR,
} from "./utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(39.9)).toContain("39,90");
    expect(formatBRL(1234.5)).toContain("1.234,50");
    expect(formatBRL(0)).toContain("0,00");
  });
});

describe("formatDuration", () => {
  it("minutos abaixo de 1h", () => {
    expect(formatDuration(45)).toBe("45 min");
  });
  it("horas exatas", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });
  it("horas e minutos", () => {
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(125)).toBe("2h05");
  });
});

describe("formatServicePrice", () => {
  it("sob consulta", () => {
    expect(formatServicePrice(0, "on_request")).toBe("Sob consulta");
  });
  it("a partir de", () => {
    expect(formatServicePrice(50, "from")).toContain("A partir de");
    expect(formatServicePrice(50, "from")).toContain("50,00");
  });
  it("preço exato (padrão)", () => {
    expect(formatServicePrice(50)).toContain("50,00");
    expect(formatServicePrice(50)).not.toContain("A partir de");
  });
});

describe("waLink", () => {
  it("prefixa 55 quando falta", () => {
    expect(waLink("11999998888")).toBe("https://wa.me/5511999998888");
  });
  it("não duplica o 55", () => {
    expect(waLink("5511999998888")).toBe("https://wa.me/5511999998888");
  });
  it("ignora máscara/caracteres", () => {
    expect(waLink("(11) 99999-8888")).toBe("https://wa.me/5511999998888");
  });
  it("sem telefone abre wa.me sem destinatário", () => {
    expect(waLink(null)).toBe("https://wa.me/");
    expect(waLink("")).toBe("https://wa.me/");
  });
  it("inclui texto codificado", () => {
    expect(waLink("11999998888", "Olá!")).toBe(
      "https://wa.me/5511999998888?text=Ol%C3%A1!",
    );
  });
});

describe("datas no fuso do Brasil (servidor em UTC)", () => {
  it("todayInBR usa o dia do Brasil mesmo perto da meia-noite UTC", () => {
    // 2026-03-10 02:00 UTC = 2026-03-09 23:00 no Brasil (-03:00)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T02:00:00Z"));
    expect(todayInBR()).toEqual({ year: 2026, month: 3, day: 9 });
    expect(currentMonthBR()).toBe("2026-03");
  });

  it("startOfTodayBR / startOfTomorrowBR retornam meia-noite BRT em UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T18:00:00Z")); // 15:00 BRT, dia 15
    // 00:00 BRT do dia 15 = 03:00 UTC
    expect(startOfTodayBR()).toBe("2026-06-15T03:00:00.000Z");
    expect(startOfTomorrowBR()).toBe("2026-06-16T03:00:00.000Z");
  });

  it("monthRangeBR cobre o mês inteiro (fevereiro com 28 dias)", () => {
    const { start, end } = monthRangeBR("2026-02");
    expect(start).toBe("2026-02-01T03:00:00.000Z");
    // 2026-02-28 23:59:59 BRT = 2026-03-01 02:59:59 UTC
    expect(end).toBe("2026-03-01T02:59:59.000Z");
  });

  it("monthRangeBR lida com ano bissexto (2028 → 29 dias)", () => {
    const { end } = monthRangeBR("2028-02");
    // 2028-02-29 23:59:59 BRT = 2028-03-01 02:59:59 UTC
    expect(end).toBe("2028-03-01T02:59:59.000Z");
  });
});
