"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { ArrowClockwise, CaretDown, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { formatBrPhone } from "@/lib/whatsapp/phone";
import { quando, rotuloTipo, situacao, type Tom } from "@/lib/whatsapp/rotulos";

type Mensagem = {
  id: string;
  kind: string;
  status: string;
  skip_reason: string | null;
  last_error: string | null;
  phone: string;
  body: string;
  scheduled_for: string | null;
  quando: string;
  cliente: string | null;
};

const CORES: Record<Tom, string> = {
  ok: "bg-green-500/15 text-green-700 dark:text-green-400",
  espera: "bg-accent/15 text-accent",
  neutro: "bg-muted text-muted-foreground",
  erro: "bg-red-500/15 text-red-700 dark:text-red-400",
};

/**
 * Últimas mensagens enviadas pelo salão.
 *
 * Responde uma pergunta só, e por isso a lista é curta e sem filtro: "saiu ou
 * não saiu, e por quê". Quem quiser conversar com o cliente abre o WhatsApp —
 * este painel não é caixa de entrada.
 */
export function WhatsAppHistorico({ slug }: { slug: string }) {
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const buscar = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/mensagens?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!alive.current) return;
      if (!res.ok) {
        setErro(true);
        return;
      }
      setErro(false);
      setMsgs(data.mensagens ?? []);
    } catch {
      if (alive.current) setErro(true);
    }
  }, [slug]);

  // A primeira carga não acende o spin do botão: `msgs === null` já desenha o
  // "Carregando…", e girar as duas coisas ao mesmo tempo é ruído.
  useEffect(() => { void buscar(); }, [buscar]);

  async function atualizar() {
    setCarregando(true);
    await buscar();
    if (alive.current) setCarregando(false);
  }

  if (erro) return null;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">Últimas mensagens</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            O que saiu do seu número — e, quando não saiu, o motivo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void atualizar()}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <ArrowClockwise className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {msgs === null ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : msgs.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Nenhuma mensagem ainda. A primeira sai sozinha no próximo agendamento.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {msgs.map((m) => {
            const s = situacao(m);
            const abertaAgora = aberta === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setAberta(abertaAgora ? null : m.id)}
                  aria-expanded={abertaAgora}
                  className="flex w-full items-start gap-3 py-3 text-left transition hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <b className="truncate text-sm font-semibold">
                        {m.cliente ?? formatBrPhone(m.phone) ?? m.phone}
                      </b>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CORES[s.tom]}`}
                      >
                        {s.texto}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {rotuloTipo(m.kind)} · {quando(m.quando)}
                    </span>
                    {s.detalhe && (
                      <span className="mt-1 block text-xs text-muted-foreground">{s.detalhe}</span>
                    )}
                  </span>
                  <CaretDown
                    className={`mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                      abertaAgora ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* O texto exato que a cliente recebeu. É o que responde "o que
                    vocês mandaram pra ela?" sem precisar pedir print. */}
                {abertaAgora && (
                  <p className="mb-3 whitespace-pre-wrap rounded-[var(--radius)] bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    {m.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Sem isto a lista mente por omissão: mensagem que nunca entrou na fila
          não tem linha nenhuma, e a ausência pareceria falha de envio. */}
      <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
        Aparece aqui só o que chegou a entrar na fila. Cliente que pediu para
        sair, ou que já recebeu 4 mensagens suas nos últimos 7 dias, não entra —
        são travas que protegem seu número de bloqueio.
      </p>
    </Card>
  );
}
