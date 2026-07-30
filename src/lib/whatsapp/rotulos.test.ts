import { describe, it, expect } from "vitest";
import { rotuloTipo, situacao, quando, type OutboxKind } from "./rotulos";

const KINDS: OutboxKind[] = [
  "booking_receipt",
  "thank_you",
  "reminder_confirm",
  "review_request",
  "opt_out_ack",
  "confirm_ack",
  "decline_ack",
  "opt_in_ack",
  "winback_no_show",
  "winback_cancelled",
  "winback_inactive",
];

describe("rotuloTipo", () => {
  it("traduz todos os tipos que o banco pode gerar", () => {
    for (const k of KINDS) {
      expect(rotuloTipo(k)).not.toBe("Mensagem");
      expect(rotuloTipo(k)).not.toContain("_");
    }
  });

  it("não quebra com tipo novo que ainda não foi traduzido", () => {
    expect(rotuloTipo("kind_do_futuro")).toBe("Mensagem");
  });
});

describe("situacao", () => {
  const agora = new Date("2026-07-30T15:00:00Z");

  it("enviada é a única verde", () => {
    expect(situacao({ status: "sent" })).toEqual({ tom: "ok", texto: "Enviada" });
  });

  it("na fila com hora marcada diz a hora", () => {
    const s = situacao({ status: "queued", scheduled_for: "2026-07-30T15:30:00Z" }, agora);
    expect(s.tom).toBe("espera");
    expect(s.detalhe).toMatch(/^Sai às \d{2}:\d{2}$/);
  });

  it("hora que já passou não vira promessa de futuro", () => {
    const s = situacao({ status: "queued", scheduled_for: "2026-07-30T14:00:00Z" }, agora);
    expect(s.detalhe).toBeUndefined();
  });

  it("erro na primeira tentativa aparece, mesmo ainda na fila", () => {
    const s = situacao({ status: "queued", last_error: "network: timeout" }, agora);
    expect(s.texto).toBe("Tentando de novo");
    expect(s.tom).toBe("espera");
  });

  // O ponto do módulo: descarte não é falha, e não pode parecer falha.
  it("agendamento cancelado não é erro", () => {
    const s = situacao({ status: "skipped", skip_reason: "agendamento_cancelled" });
    expect(s.tom).toBe("neutro");
    expect(s.detalhe).toContain("cancelado");
  });

  it("número sem WhatsApp não é erro, e diz onde consertar", () => {
    const s = situacao({ status: "skipped", skip_reason: 'http_400: {"message":"not found"}' });
    expect(s.tom).toBe("neutro");
    expect(s.detalhe).toContain("ficha do cliente");
  });

  it("opt-out explica que dá pra religar", () => {
    const s = situacao({ status: "skipped", skip_reason: "opt_out" });
    expect(s.detalhe).toContain("religar");
  });

  it("motivo de descarte desconhecido não inventa explicação", () => {
    const s = situacao({ status: "skipped", skip_reason: "motivo_novo" });
    expect(s.tom).toBe("neutro");
    expect(s.detalhe).toBeUndefined();
  });

  it("falha de verdade é a única vermelha", () => {
    const s = situacao({ status: "failed", last_error: "http_500: boom" });
    expect(s.tom).toBe("erro");
    expect(s.detalhe).toContain("mais tarde");
  });

  it("nenhum detalhe vaza jargão técnico", () => {
    const casos = [
      { status: "failed", last_error: "network: timeout" },
      { status: "failed", last_error: "travada_em_sending" },
      { status: "failed", last_error: "instancia_nao_encontrada" },
      { status: "failed", last_error: 'http_401: {"status":401}' },
      { status: "failed", last_error: null },
      { status: "skipped", skip_reason: "whatsapp_desconectado" },
    ];
    for (const c of casos) {
      const d = situacao(c).detalhe ?? "";
      expect(d).not.toMatch(/http_|_|null|undefined/);
    }
  });
});

describe("quando", () => {
  const agora = new Date("2026-07-30T18:00:00");

  it("usa o dia do calendário, não 24h atrás", () => {
    // 23h de ontem é menos de 24h atrás, mas ainda é "ontem" pra quem lê.
    expect(quando("2026-07-29T23:30:00", agora)).toMatch(/^Ontem /);
    expect(quando("2026-07-30T00:10:00", agora)).toMatch(/^Hoje /);
  });

  it("mais antigo mostra a data", () => {
    expect(quando("2026-07-28T16:11:00", agora)).toMatch(/^28\/07 /);
  });
});
