"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { waPhone, type LateClient } from "./AgendaSignalsBanner";
import { ArrowSquareOut, ChatCircle, Check, CircleNotch } from "@phosphor-icons/react/dist/ssr";

/** Texto do wa.me — a saída manual, para quando a fila não pode dar conta. */
function urlWhatsApp(client: LateClient) {
  const primeiro = client.name.split(" ")[0];
  const msg =
    `Oi${primeiro && primeiro !== "Cliente" ? ` ${primeiro}` : ""}! Tudo bem? ` +
    `Você tinha um horário marcado aqui hoje às ${client.time} 💇 ` +
    `Ainda vem ou prefere remarcar?`;
  const fone = waPhone(client.phone);
  return fone ? `https://wa.me/${fone}?text=${encodeURIComponent(msg)}` : null;
}

/**
 * Motivos que o banco devolve, em português. Os dois primeiros não são falha:
 * são situações em que mandar pela fila seria errado, e aí a saída é o
 * WhatsApp na mão — por isso `manual: true`.
 */
const MOTIVO: Record<string, { texto: string; manual?: boolean }> = {
  nao_conectado:    { texto: "WhatsApp do salão não está conectado.", manual: true },
  fora_do_horario:  { texto: "Fora da janela de envio (8h–20h) — sairia só amanhã.", manual: true },
  opt_out:          { texto: "Ela pediu para não receber mensagens." },
  sem_telefone:     { texto: "Sem telefone válido na ficha." },
  cliente_invalido: { texto: "Sem telefone válido na ficha." },
  ja_avisado:       { texto: "Já avisada." },
  ja_resolvido:     { texto: "Esse horário já teve baixa." },
  tarde_demais:     { texto: "Passou muito da hora — melhor chamar para remarcar." },
  limite_semanal:   { texto: "Já recebeu 4 mensagens esta semana." },
  ainda_nao_passou: { texto: "O horário ainda não chegou." },
};

/**
 * "Lembrar Fulana (14:00)" — um toque, saindo pelo número do salão.
 *
 * Antes era um link wa.me: o dono saía do painel e a mensagem ia pelo aparelho
 * dele, fora do sistema, sem registro e sem respeitar opt-out. Agora entra na
 * mesma fila do resto, e o wa.me fica de reserva para quando a fila não pode
 * dar conta (instância caída, fora da janela de envio).
 *
 * O clique continua sendo a autorização — nada sai sozinho.
 */
export function LateNudgeButton({ client }: { client: LateClient }) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado">("idle");
  const [erro, setErro] = useState<{ texto: string; manual?: boolean } | null>(null);
  const primeiro = client.name.split(" ")[0];
  const url = urlWhatsApp(client);

  async function enviar() {
    setEstado("enviando");
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("whatsapp_late_send" as never, {
      p_appointment: client.id,
    } as never);

    const r = data as { ok?: boolean; reason?: string } | null;
    if (error || !r?.ok) {
      setEstado("idle");
      setErro(
        (r?.reason ? MOTIVO[r.reason] : undefined) ?? {
          texto: "Não foi possível enviar agora.",
          manual: true,
        },
      );
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> {primeiro} avisada
      </span>
    );
  }

  if (!client.phone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        {primeiro} ({client.time}) — sem WhatsApp cadastrado
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={enviar}
        disabled={estado === "enviando"}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 disabled:opacity-60 dark:text-amber-400"
      >
        {estado === "enviando"
          ? <CircleNotch className="h-3.5 w-3.5 animate-spin" />
          : <ChatCircle className="h-3.5 w-3.5" />}
        Lembrar {primeiro} ({client.time})
      </button>

      {erro && (
        <span className="text-[11px] text-muted-foreground">
          {erro.texto}
          {/* Só oferece o caminho manual onde ele resolve. Em opt-out, não:
              a saída manual ali seria furar o que a cliente pediu. */}
          {erro.manual && url && (
            <>
              {" "}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
              >
                Abrir no WhatsApp <ArrowSquareOut className="h-3 w-3" />
              </a>
            </>
          )}
        </span>
      )}
    </span>
  );
}
