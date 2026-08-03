"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { Select } from "@/components/Select";
import { cn } from "@/lib/utils";
import { mensagemRpc } from "@/lib/erroSupabase";
import {
  CircleNotch,
  Hammer,
  PencilSimple,
  RocketLaunch,
  Trash,
} from "@phosphor-icons/react/dist/ssr";

/** Igual à aba da dona: dez por vez, com página seguinte sob demanda. */
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
  salon_id: string;
  salon_name: string;
  author_name: string | null;
  body: string;
  status: string;
  reply: string | null;
  update_id: string | null;
  update_title: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  novidade: "Novidade",
  melhoria: "Melhoria",
  correcao: "Correção",
};

const STATUS_LABEL: Record<string, string> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  planejada: "Planejada",
  em_construcao: "Em construção",
  entregue: "Entregue",
  nao_planejada: "Não vamos fazer",
};

function data(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Atualizações — escrever o histórico e responder as sugestões.
 *
 * Duas telas que só fazem sentido juntas: a sugestão vira entrega, e a entrega
 * fecha a sugestão. Por isso o vínculo é um campo aqui e não uma anotação
 * mental — `admin_ship_update` usa esse vínculo pra marcar como entregue quem
 * pediu, no mesmo clique em que publica.
 *
 * O que se escreve aqui a dona lê. Vale o mesmo critério dos commits: publica
 * o que muda o que ela vê ou faz, e nada de refatoração ou detalhe interno.
 */
export function UpdatesAdminPanel() {
  const supabase = createClient();

  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [temMaisUpdates, setTemMaisUpdates] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [temMaisSugestoes, setTemMaisSugestoes] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState<"updates" | "sugestoes" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Formulário de entrega. `id` preenchido = editando uma existente.
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("novidade");

  // Pede um a mais do que mostra: se o extra vier, existe próxima página —
  // sem precisar de uma consulta de contagem só pra decidir se o botão aparece.
  const pagina = useCallback(async (rpc: string, offset: number) => {
    const { data } = await supabase.rpc(rpc as never, {
      p_limit: PAGINA + 1, p_offset: offset,
    } as never);
    const linhas = (Array.isArray(data) ? data : []) as unknown[];
    return { linhas: linhas.slice(0, PAGINA), temMais: linhas.length > PAGINA };
  }, [supabase]);

  const recarregar = useCallback(async () => {
    const [u, s] = await Promise.all([
      pagina("admin_list_updates", 0),
      pagina("admin_list_suggestions", 0),
    ]);
    setUpdates(u.linhas as Update[]);
    setTemMaisUpdates(u.temMais);
    setSuggestions(s.linhas as Suggestion[]);
    setTemMaisSugestoes(s.temMais);
  }, [pagina]);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      pagina("admin_list_updates", 0),
      pagina("admin_list_suggestions", 0),
    ]).then(([u, s]) => {
      if (!vivo) return;
      setUpdates(u.linhas as Update[]);
      setTemMaisUpdates(u.temMais);
      setSuggestions(s.linhas as Suggestion[]);
      setTemMaisSugestoes(s.temMais);
    });
    return () => { vivo = false; };
  }, [pagina]);

  async function maisUpdates() {
    setCarregandoMais("updates");
    const r = await pagina("admin_list_updates", updates?.length ?? 0);
    setUpdates((a) => [...(a ?? []), ...(r.linhas as Update[])]);
    setTemMaisUpdates(r.temMais);
    setCarregandoMais(null);
  }

  async function maisSugestoes() {
    setCarregandoMais("sugestoes");
    const r = await pagina("admin_list_suggestions", suggestions.length);
    setSuggestions((a) => [...a, ...(r.linhas as Suggestion[])]);
    setTemMaisSugestoes(r.temMais);
    setCarregandoMais(null);
  }

  function limpar() {
    setId(null); setTitle(""); setBody(""); setKind("novidade");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.rpc("admin_save_update" as never, {
      p_id: id, p_title: title, p_body: body, p_kind: kind,
    } as never);
    setSalvando(false);
    if (error) {
      setErro(mensagemRpc(error, "Não deu para salvar. Tente de novo."));
      return;
    }
    limpar();
    recarregar();
  }

  async function publicar(u: Update) {
    if (!confirm(`Publicar "${u.title}"? Ela passa a aparecer para todos os salões.`)) return;
    setErro(null);
    const { error } = await supabase.rpc("admin_ship_update" as never, { p_id: u.id } as never);
    if (error) { setErro(mensagemRpc(error, "Não deu para publicar.")); return; }
    recarregar();
  }

  async function apagar(u: Update) {
    if (!confirm(`Apagar "${u.title}"? Isso some do histórico de todos os salões.`)) return;
    setErro(null);
    const { error } = await supabase.rpc("admin_delete_update" as never, { p_id: u.id } as never);
    if (error) { setErro(mensagemRpc(error, "Não deu para apagar.")); return; }
    recarregar();
  }

  const emConstrucao = (updates ?? []).filter((u) => u.status === "building");

  // Conta só o que está carregado. Como 'recebida' vem primeiro na ordenação,
  // a primeira página tem todas — a menos que passem de uma página inteira, e
  // aí o número vira "10+" em vez de mentir para menos.
  const naoRespondidas = suggestions.filter((s) => s.status === "recebida").length;
  const contagemPendente =
    temMaisSugestoes && naoRespondidas === PAGINA ? `${PAGINA}+` : String(naoRespondidas);

  return (
    <div className="space-y-5">
      {erro && (
        <p role="alert" className="rounded-[var(--radius)] bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}

      {/* ── Escrever uma entrega ─────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">
          {id ? "Editando a entrega" : "Nova entrega"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Nasce em construção. Publicar é o segundo passo — e é ele que fecha as
          sugestões vinculadas.
        </p>

        <form onSubmit={salvar} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label htmlFor="up-title">Título</Label>
              <Input
                id="up-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Atendimento em domicílio confirma pelo WhatsApp"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-kind">Tipo</Label>
              <Select id="up-kind" value={kind} onValueChange={setKind}>
                <option value="novidade">Novidade</option>
                <option value="melhoria">Melhoria</option>
                <option value="correcao">Correção</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-body">Texto</Label>
            <textarea
              id="up-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Escreva do ponto de vista dela: o que passou a ser possível, não o que foi alterado no código."
              className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!title.trim() || !body.trim() || salvando}>
              {salvando && <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />}
              {id ? "Salvar alterações" : "Criar em construção"}
            </Button>
            {id && (
              <Button type="button" size="sm" variant="outline" onClick={limpar}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* ── O que existe ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">
          Entregas
          {emConstrucao.length > 0 && (
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              {emConstrucao.length} em construção
            </span>
          )}
        </h2>

        {updates === null ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : updates.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nada escrito ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {updates.map((u) => (
              <li key={u.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {u.status === "building" && (
                      <Hammer aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    )}
                    {u.title}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                      {KIND_LABEL[u.kind] ?? u.kind}
                    </span>
                    {u.shipped_at && (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {data(u.shipped_at)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{u.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setId(u.id); setTitle(u.title); setBody(u.body); setKind(u.kind); }}
                    aria-label={`Editar ${u.title}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <PencilSimple aria-hidden className="h-4 w-4" />
                  </button>
                  {u.status === "building" && (
                    <button
                      type="button"
                      onClick={() => publicar(u)}
                      aria-label={`Publicar ${u.title}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                      <RocketLaunch aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => apagar(u)}
                    aria-label={`Apagar ${u.title}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] dark:hover:bg-red-500/10"
                  >
                    <Trash aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {temMaisUpdates && (
          <Button variant="outline" size="sm" onClick={maisUpdates}
                  disabled={carregandoMais === "updates"} className="mt-3 w-full">
            {carregandoMais === "updates" && (
              <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
            )}
            Mostrar mais
          </Button>
        )}
      </Card>

      {/* ── A fila de sugestões ──────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">
          Sugestões
          {naoRespondidas > 0 && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {contagemPendente} sem resposta
            </span>
          )}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Recusar exige motivo escrito — é o que a dona vai ler no lugar do
          silêncio.
        </p>

        {suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma sugestão ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.id}
                s={s}
                updates={updates ?? []}
                onSalvo={recarregar}
                onErro={setErro}
              />
            ))}
          </ul>
        )}

        {temMaisSugestoes && (
          <Button variant="outline" size="sm" onClick={maisSugestoes}
                  disabled={carregandoMais === "sugestoes"} className="mt-3 w-full">
            {carregandoMais === "sugestoes" && (
              <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
            )}
            Mostrar mais
          </Button>
        )}
      </Card>
    </div>
  );
}

function SuggestionRow({
  s, updates, onSalvo, onErro,
}: {
  s: Suggestion;
  updates: Update[];
  onSalvo: () => void;
  onErro: (m: string | null) => void;
}) {
  const supabase = createClient();
  const [status, setStatus] = useState(s.status);
  const [reply, setReply] = useState(s.reply ?? "");
  const [vinculo, setVinculo] = useState(s.update_id ?? "");
  const [salvando, setSalvando] = useState(false);

  const mudou = status !== s.status || reply !== (s.reply ?? "") || vinculo !== (s.update_id ?? "");
  // O CHECK da tabela recusa isso; barrar aqui evita a viagem até o banco pra
  // voltar com erro.
  const faltaMotivo = status === "nao_planejada" && !reply.trim();

  async function salvar() {
    setSalvando(true);
    onErro(null);
    const { error } = await supabase.rpc("admin_set_suggestion_status" as never, {
      p_id: s.id,
      p_status: status,
      p_reply: reply.trim() || null,
      p_update: vinculo || null,
    } as never);
    setSalvando(false);
    if (error) {
      onErro(mensagemRpc(error, "Não deu para salvar a sugestão."));
      return;
    }
    onSalvo();
  }

  return (
    <li className="rounded-[var(--radius)] border border-border p-3">
      <p className="text-xs text-muted-foreground">
        <b className="text-foreground">{s.salon_name}</b>
        {s.author_name ? ` · ${s.author_name}` : ""} · {data(s.created_at)}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm">{s.body}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`st-${s.id}`} className="text-xs text-muted-foreground">Status</label>
          <Select id={`st-${s.id}`} value={status} onValueChange={setStatus}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`vin-${s.id}`} className="text-xs text-muted-foreground">
            Vincular a uma entrega
          </label>
          <Select
            id={`vin-${s.id}`}
            value={vinculo}
            onValueChange={setVinculo}
            placeholder="Nenhuma"
          >
            <option value="">Nenhuma</option>
            {updates.map((u) => (
              <option key={u.id} value={u.id}>{u.title}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <label htmlFor={`rep-${s.id}`} className="text-xs text-muted-foreground">
          Resposta {status === "nao_planejada" && <span className="text-red-600">(obrigatória)</span>}
        </label>
        <textarea
          id={`rep-${s.id}`}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          placeholder="O que ela vai ler."
          className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={cn("text-xs", faltaMotivo ? "text-red-600" : "text-muted-foreground")}>
          {faltaMotivo
            ? "Escreva o motivo antes de recusar."
            : s.update_title
            ? `Vinculada a: ${s.update_title}`
            : ""}
        </span>
        <Button size="sm" onClick={salvar} disabled={!mudou || faltaMotivo || salvando}>
          {salvando && <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </li>
  );
}
