"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { mensagemRpc } from "@/lib/erroSupabase";
import {
  CircleNotch,
  Hammer,
  Lightbulb,
  PaperPlaneTilt,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

/** Quantos itens por vez. Dez cobre a tela sem obrigar a rolar pra achar o botão. */
const PAGINA = 10;

type Update = {
  id: string;
  title: string;
  body: string;
  kind: string;
  status: string;
  shipped_at: string | null;
};

type Suggestion = {
  id: string;
  body: string;
  status: string;
  reply: string | null;
  created_at: string;
  update_id: string | null;
};

/** O tipo diz como ler a linha: o que é novo, o que melhorou, o que estava errado. */
const KIND: Record<string, { label: string; classe: string }> = {
  novidade: { label: "Novidade", classe: "bg-primary text-primary-foreground" },
  melhoria: { label: "Melhoria", classe: "bg-secondary text-primary" },
  correcao: { label: "Correção", classe: "bg-muted text-foreground/70" },
};

/**
 * O estado de cada sugestão, com o texto que a dona lê.
 *
 * "Não vamos fazer" existe e é dito assim mesmo. A alternativa — deixar a
 * sugestão parada em "recebida" para sempre — é a que faz alguém desistir de
 * escrever de novo.
 */
const STATUS: Record<string, { label: string; classe: string }> = {
  recebida:      { label: "Recebida",       classe: "bg-muted text-foreground/70" },
  em_analise:    { label: "Em análise",     classe: "bg-muted text-foreground/70" },
  planejada:     { label: "Planejada",      classe: "bg-secondary text-primary" },
  em_construcao: { label: "Em construção",  classe: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" },
  entregue:      { label: "Entregue",       classe: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" },
  nao_planejada: { label: "Não vamos fazer", classe: "bg-muted text-foreground/60" },
};

/** "3 de agosto" — e o ano só quando não for este, que é quando ele informa algo. */
function quando(iso: string): string {
  const d = new Date(iso);
  const mesmoAno = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    ...(mesmoAno ? {} : { year: "numeric" }),
  });
}

function Selo({ label, classe }: { label: string; classe: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", classe)}>
      {label}
    </span>
  );
}

/**
 * Atualizações — o que mudou, o que está sendo feito, e o que ela pediu.
 *
 * A pergunta que esta tela responde não é "que recurso tem?", é "isso aqui
 * está vivo?". Por isso o histórico vem completo e datado: a prova é a
 * quantidade e a frequência, não o texto de nenhum item.
 *
 * Não há esteira com prazo de propósito. Só existe "em construção agora", sem
 * data — prometer setembro e entregar novembro estraga mais confiança do que
 * a promessa comprava.
 */
export function UpdatesPanel({ salonId }: { salonId: string }) {
  const supabase = createClient();

  // "Em construção" não pagina: é sempre curto por natureza — o que está sendo
  // feito AGORA. Quem cresce sem parar é o histórico, e é só ele que ganha o
  // botão de mostrar mais.
  const [building, setBuilding] = useState<Update[]>([]);
  const [shipped, setShipped] = useState<Update[] | null>(null);
  const [temMaisEntregas, setTemMaisEntregas] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [temMaisSugestoes, setTemMaisSugestoes] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState<"entregas" | "sugestoes" | null>(null);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  /**
   * Pede sempre um item a mais do que vai mostrar. Se o extra vier, existe
   * próxima página — e isso evita uma segunda consulta de contagem só pra
   * decidir se um botão aparece.
   */
  const paginaEntregas = useCallback(async (offset: number) => {
    const { data } = await supabase
      .from("product_updates")
      .select("id, title, body, kind, status, shipped_at")
      .eq("status", "shipped")
      .order("shipped_at", { ascending: false })
      .range(offset, offset + PAGINA);
    const linhas = (data as Update[] | null) ?? [];
    return { linhas: linhas.slice(0, PAGINA), temMais: linhas.length > PAGINA };
  }, [supabase]);

  const paginaSugestoes = useCallback(async (offset: number) => {
    const { data } = await supabase
      .from("product_suggestions")
      .select("id, body, status, reply, created_at, update_id")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGINA);
    const linhas = (data as Suggestion[] | null) ?? [];
    return { linhas: linhas.slice(0, PAGINA), temMais: linhas.length > PAGINA };
  }, [supabase, salonId]);

  const buscarInicio = useCallback(async () => {
    const [{ data: b }, entregas, sugestoes] = await Promise.all([
      supabase
        .from("product_updates")
        .select("id, title, body, kind, status, shipped_at")
        .eq("status", "building")
        .order("created_at", { ascending: false }),
      paginaEntregas(0),
      paginaSugestoes(0),
    ]);
    return { building: (b as Update[] | null) ?? [], entregas, sugestoes };
  }, [supabase, paginaEntregas, paginaSugestoes]);

  const aplicarInicio = useCallback((r: Awaited<ReturnType<typeof buscarInicio>>) => {
    setBuilding(r.building);
    setShipped(r.entregas.linhas);
    setTemMaisEntregas(r.entregas.temMais);
    setSuggestions(r.sugestoes.linhas);
    setTemMaisSugestoes(r.sugestoes.temMais);
  }, []);

  useEffect(() => {
    let vivo = true;
    buscarInicio().then((r) => { if (vivo) aplicarInicio(r); });
    // Abrir esta aba É ter lido. Zera o pontinho do Dashboard sem pedir mais
    // um clique de "ok, entendi".
    supabase.rpc("mark_product_updates_seen" as never);
    return () => { vivo = false; };
  }, [buscarInicio, aplicarInicio, supabase]);

  async function maisEntregas() {
    setCarregandoMais("entregas");
    const r = await paginaEntregas(shipped?.length ?? 0);
    setShipped((atual) => [...(atual ?? []), ...r.linhas]);
    setTemMaisEntregas(r.temMais);
    setCarregandoMais(null);
  }

  async function maisSugestoes() {
    setCarregandoMais("sugestoes");
    const r = await paginaSugestoes(suggestions.length);
    setSuggestions((atual) => [...atual, ...r.linhas]);
    setTemMaisSugestoes(r.temMais);
    setCarregandoMais(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const corpo = texto.trim();
    if (!corpo) return;

    setEnviando(true);
    setErro(null);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("product_suggestions").insert({
      salon_id: salonId,
      author_id: auth.user?.id ?? null,
      body: corpo,
    });
    setEnviando(false);

    if (error) {
      setErro(mensagemRpc(error, "Não deu para enviar sua sugestão. Tente de novo."));
      return;
    }
    setTexto("");
    setEnviada(true);
    // Volta pra primeira página: a sugestão nova é a mais recente, então é lá
    // que ela está — e recarregar o que já foi paginado seria trabalho à toa.
    aplicarInicio(await buscarInicio());
  }

  return (
    <div className="space-y-5">
      {/* ── Em construção agora ──────────────────────────────────────── */}
      {building.length > 0 && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Hammer aria-hidden className="h-4 w-4 text-amber-600" />
            Em construção agora
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O que está sendo feito neste momento. Sem data — a gente prefere
            avisar quando estiver no ar.
          </p>
          <ul className="mt-3 space-y-3">
            {building.map((u) => (
              <li key={u.id} className="border-l-2 border-amber-400 pl-3">
                <p className="text-sm font-semibold">{u.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{u.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── O que já entregamos ──────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkle aria-hidden className="h-4 w-4 text-primary" weight="fill" />
          O que já entregamos
        </h2>

        {shipped === null ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
            Carregando…
          </p>
        ) : shipped.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ainda não há nada publicado aqui. Assim que a primeira entrega sair,
            ela aparece nesta lista.
          </p>
        ) : (
          <ol className="mt-3 space-y-4">
            {shipped.map((u) => (
              <li key={u.id} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Selo {...(KIND[u.kind] ?? KIND.novidade)} />
                  <time
                    dateTime={u.shipped_at ?? undefined}
                    className="text-xs text-muted-foreground"
                  >
                    {u.shipped_at ? quando(u.shipped_at) : ""}
                  </time>
                </div>
                <p className="mt-1 text-sm font-semibold">{u.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{u.body}</p>
              </li>
            ))}
          </ol>
        )}

        {temMaisEntregas && (
          <Button
            variant="outline"
            size="sm"
            onClick={maisEntregas}
            disabled={carregandoMais === "entregas"}
            className="mt-4 w-full"
          >
            {carregandoMais === "entregas" && (
              <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
            )}
            Mostrar mais
          </Button>
        )}
      </Card>

      {/* ── A sugestão dela ──────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb aria-hidden className="h-4 w-4 text-primary" />
          Sugira uma melhoria
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Você usa o sistema todo dia — se falta alguma coisa, ou se algo é mais
          trabalhoso do que precisava ser, escreve aqui. Toda sugestão é lida e
          respondida, inclusive quando a resposta é não.
        </p>

        <form onSubmit={enviar} className="mt-3">
          <label htmlFor="sugestao" className="sr-only">
            Sua sugestão
          </label>
          <textarea
            id="sugestao"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setEnviada(false); }}
            rows={4}
            maxLength={1000}
            placeholder="Ex.: queria poder ver quanto cada profissional fez no mês sem precisar abrir o relatório inteiro."
            className={cn(
              "w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              // No celular, ao focar um campo o navegador rola só até a borda da
              // área rolável — e a barra inferior é fixa POR CIMA dela. O campo
              // ficava 65px escondido atrás da barra (a altura dela), e o botão
              // Enviar, mais abaixo, sumia de vez. Esta margem é o espaço que o
              // navegador precisa reservar ao rolar: a barra mais a linha do
              // contador e do botão, que vêm logo depois do campo.
              "max-lg:[scroll-margin-bottom:calc(8rem+env(safe-area-inset-bottom))]",
            )}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span aria-live="polite" className="text-xs">
              {erro ? (
                <span className="text-red-600">{erro}</span>
              ) : enviada ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Recebemos! Você acompanha o andamento aqui embaixo.
                </span>
              ) : (
                <span className="text-muted-foreground">{texto.trim().length}/1000</span>
              )}
            </span>
            <Button type="submit" size="sm" disabled={!texto.trim() || enviando}>
              {enviando ? (
                <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <PaperPlaneTilt aria-hidden className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </form>

        {suggestions.length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suas sugestões
            </h3>
            <ul className="mt-2 divide-y divide-border">
              {suggestions.map((s) => {
                const st = STATUS[s.status] ?? STATUS.recebida;
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 whitespace-pre-line text-sm">{s.body}</p>
                      <Selo {...st} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enviada em {quando(s.created_at)}
                    </p>
                    {/* A resposta é o que fecha o ciclo. Sem ela o status
                        sozinho ainda é uma etiqueta sem explicação. */}
                    {s.reply && (
                      <p className="mt-1.5 rounded-[var(--radius)] bg-muted px-3 py-2 text-sm">
                        {s.reply}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {temMaisSugestoes && (
              <Button
                variant="outline"
                size="sm"
                onClick={maisSugestoes}
                disabled={carregandoMais === "sugestoes"}
                className="mt-3 w-full"
              >
                {carregandoMais === "sugestoes" && (
                  <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
                )}
                Mostrar mais
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
