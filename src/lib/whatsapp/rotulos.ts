/**
 * Tradução da fila de WhatsApp para a língua do dono do salão.
 *
 * A fila fala em `booking_receipt`, `skipped`, `http_400` — vocabulário de
 * quem escreveu o sistema. Quem abre o painel quer responder uma pergunta só:
 * "a mensagem chegou pra fulana, e se não chegou, por quê?". Todo rótulo aqui
 * existe pra responder isso sem exigir tradução de ninguém.
 *
 * Fica em módulo separado (e testado) porque errar um rótulo aqui não quebra a
 * tela: só faz o dono entender errado — o tipo de defeito que passa despercebido.
 */

export type OutboxStatus = "queued" | "sending" | "sent" | "failed" | "skipped";

export type OutboxKind =
  | "booking_receipt"
  | "thank_you"
  | "reminder_confirm"
  | "review_request"
  | "opt_out_ack"
  | "confirm_ack"
  | "decline_ack"
  | "opt_in_ack"
  | "winback_no_show"
  | "winback_cancelled"
  | "winback_inactive";

const TIPOS: Record<OutboxKind, string> = {
  booking_receipt: "Comprovante do agendamento",
  thank_you: "Agradecimento",
  reminder_confirm: "Confirmação da véspera",
  review_request: "Pedido de avaliação",
  // Os quatro "ack" são o que o sistema respondeu a uma mensagem do cliente.
  // O prefixo comum deixa claro que a conversa partiu dele, não do salão.
  confirm_ack: "Resposta: horário confirmado",
  decline_ack: "Resposta: horário desmarcado",
  opt_out_ack: "Resposta: parou de receber",
  opt_in_ack: "Resposta: voltou a receber",
  winback_no_show: "Recuperação: faltou",
  winback_cancelled: "Recuperação: cancelou",
  winback_inactive: "Recuperação: sumiu",
};

export function rotuloTipo(kind: string): string {
  return TIPOS[kind as OutboxKind] ?? "Mensagem";
}

/**
 * `tom` guia a cor, e são quatro de propósito:
 *
 * `ok` deu certo · `espera` ainda vai acontecer · `neutro` não saiu por decisão
 * do sistema (e estava certo não sair) · `erro` não saiu e ninguém decidiu isso.
 *
 * Separar `neutro` de `erro` é o ponto todo: pintar "o agendamento foi
 * cancelado" de vermelho faz o dono procurar defeito onde o sistema acertou.
 */
export type Tom = "ok" | "espera" | "neutro" | "erro";

export type Situacao = {
  tom: Tom;
  texto: string;
  /** Frase curta com o porquê. Ausente quando o texto já se explica. */
  detalhe?: string;
};

export type LinhaFila = {
  status: string;
  skip_reason?: string | null;
  last_error?: string | null;
  scheduled_for?: string | null;
};

export function situacao(linha: LinhaFila, agora: Date = new Date()): Situacao {
  const status = linha.status as OutboxStatus;

  if (status === "sent") return { tom: "ok", texto: "Enviada" };

  if (status === "sending") return { tom: "espera", texto: "Saindo agora" };

  if (status === "queued") {
    // Já tropeçou antes: dizer só "na fila" esconderia que houve problema, e o
    // dono só descobriria quando a mensagem desistisse de vez.
    if (linha.last_error) {
      return {
        tom: "espera",
        texto: "Tentando de novo",
        detalhe: "A primeira tentativa falhou. O sistema tenta mais algumas vezes sozinho.",
      };
    }
    const quando = linha.scheduled_for ? new Date(linha.scheduled_for) : null;
    if (quando && quando.getTime() > agora.getTime()) {
      return { tom: "espera", texto: "Na fila", detalhe: `Sai às ${hora(quando)}` };
    }
    return { tom: "espera", texto: "Na fila" };
  }

  if (status === "failed") {
    return { tom: "erro", texto: "Não conseguimos enviar", detalhe: motivoErro(linha.last_error) };
  }

  if (status === "skipped") return motivoDescarte(linha.skip_reason);

  return { tom: "neutro", texto: "—" };
}

/**
 * Descarte é decisão consciente do sistema. Cada motivo vira uma frase que já
 * traz a próxima ação quando existe uma — "religar na ficha", "reconecte".
 */
function motivoDescarte(reason: string | null | undefined): Situacao {
  const r = reason ?? "";

  if (r === "agendamento_cancelled") {
    return {
      tom: "neutro",
      texto: "Não saiu",
      detalhe: "O agendamento foi cancelado antes de a mensagem sair.",
    };
  }
  if (r === "agendamento_no_show") {
    return {
      tom: "neutro",
      texto: "Não saiu",
      detalhe: "O agendamento virou falta antes de a mensagem sair.",
    };
  }
  if (r === "opt_out") {
    return {
      tom: "neutro",
      texto: "Não saiu",
      detalhe: "O cliente pediu para não receber mais. Dá pra religar na ficha dele.",
    };
  }
  if (r === "whatsapp_desconectado") {
    return {
      tom: "neutro",
      texto: "Não saiu",
      detalhe: "O WhatsApp foi desconectado antes de a mensagem sair.",
    };
  }
  // A Evolution devolve 400/404 quando o número não existe no WhatsApp. Não é
  // erro nosso e repetir não resolve — por isso não sai vermelho.
  if (/^http_(400|404)\b/.test(r)) {
    return {
      tom: "neutro",
      texto: "Não saiu",
      detalhe: "Esse número não tem WhatsApp. Confira o telefone na ficha do cliente.",
    };
  }

  return { tom: "neutro", texto: "Não saiu" };
}

function motivoErro(erro: string | null | undefined): string {
  const e = erro ?? "";

  if (e.startsWith("network:")) {
    return "O servidor de envio não respondeu. Costuma ser passageiro.";
  }
  if (e === "travada_em_sending") {
    return "A mensagem travou no meio do envio.";
  }
  if (e === "instancia_nao_encontrada") {
    return "A conexão do WhatsApp sumiu. Reconecte aqui em cima.";
  }
  if (/^http_(401|403)\b/.test(e)) {
    return "O WhatsApp recusou o envio. Reconecte o número.";
  }
  if (/^http_5\d\d\b/.test(e)) {
    return "O servidor de envio está com problema. Tente de novo mais tarde.";
  }
  return "Tentamos várias vezes e não foi. Se repetir, reconecte o número.";
}

function hora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "Hoje 14:52" · "Ontem 09:10" · "28/07 16:11" */
export function quando(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(agora) - dia(d)) / 86_400_000);

  if (diff === 0) return `Hoje ${hora(d)}`;
  if (diff === 1) return `Ontem ${hora(d)}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hora(d)}`;
}
