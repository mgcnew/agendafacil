"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AdminTabs, AdminTabPanel } from "./AdminTabs";
import { Inline, SecaoView } from "./BlocosView";
import {
  modulos as construirModulos,
  introPacote,
  moduloMd,
  nomeArquivo,
  pacoteMd,
  PAPEIS,
  type MetricasFato,
  type Modulo,
  type PapelId,
} from "@/lib/agentes";
import {
  Check,
  Copy,
  DownloadSimple,
  FileText,
  Package,
  Robot,
  Sparkle,
  Users,
  Wrench,
  Megaphone,
  Headset,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * Base de conhecimento para agentes de IA.
 *
 * O que sai daqui não é documentação para gente ler — é contexto para alimentar
 * agentes. Isso muda duas coisas no desenho: os fatos são **gerados** do sistema
 * na hora do download (preço vem do catálogo, números vêm do painel), e os
 * módulos são separados por papel, porque contexto que não serve ao agente
 * dilui a atenção dele e encarece cada chamada.
 */

const ICONE_PAPEL: Record<PapelId, PhosphorIcon> = {
  marketing: Megaphone,
  comercial: Users,
  suporte: Headset,
  manutencao: Wrench,
};

/** Dispara o download de um texto como arquivo, sem passar pelo servidor. */
function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function AgentesPanel({ metrics }: { metrics: MetricasFato | null }) {
  const [aba, setAba] = useState<"pacote" | "papeis">("pacote");

  // Gerado a cada visita: é o que garante que o preço e os números do arquivo
  // são os de agora, e não os de quando alguém escreveu o documento.
  const mods = useMemo(() => construirModulos(metrics), [metrics]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Robot aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-tight">
              Base de conhecimento para agentes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tudo o que um agente de IA precisa saber para trabalhar pelo Zulan —
              marketing, comercial, suporte e manutenção. Baixe os módulos que
              cabem ao papel do agente e cole o prompt correspondente.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius)] border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fatos gerados
            </p>
            <p className="mt-1 text-sm">
              Preço e números saem do sistema no momento do download. Documento
              escrito à mão vence numa semana — e aí o agente mente com confiança.
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Um agente por papel
            </p>
            <p className="mt-1 text-sm">
              Papéis têm regras que se contradizem de propósito: o comercial pode
              usar escassez, o suporte nunca deve.
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contrato de saída
            </p>
            <p className="mt-1 text-sm">
              Cada papel define o formato da entrega. Sem isso a resposta vem em
              prosa e sobra pra você garimpar.
            </p>
          </div>
        </div>
      </Card>

      <AdminTabs
        tabs={[
          { id: "pacote" as const, label: "Módulos", icon: FileText },
          { id: "papeis" as const, label: "Papéis e prompts", icon: Robot },
        ]}
        value={aba}
        onChange={setAba}
        label="Seções da base de conhecimento"
        ns="ag-"
        variant="chips"
      />

      <AdminTabPanel id={aba} ns="ag-">
        {aba === "pacote" ? <Modulos mods={mods} /> : <Papeis />}
      </AdminTabPanel>
    </div>
  );
}

/* ─────────────────────────── Módulos ─────────────────────────── */

function Modulos({ mods }: { mods: Modulo[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  function baixarTudo() {
    baixar(
      "zulan-base-de-conhecimento.md",
      pacoteMd(mods, "Base de conhecimento do Zulan", introPacote()),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {mods.length} módulos. Clique num para ler antes de baixar.
        </p>
        <Button onClick={baixarTudo}>
          <Package aria-hidden className="h-4 w-4" /> Baixar tudo num arquivo
        </Button>
      </div>

      <div className="space-y-3">
        {mods.map((m) => {
          const on = aberto === m.id;
          return (
            <Card key={m.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setAberto(on ? null : m.id)}
                  aria-expanded={on}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[var(--radius)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {nomeArquivo(m.arquivo)}
                    </code>
                    {m.gerado && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <Sparkle aria-hidden className="h-3 w-3" weight="fill" /> gerado
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-display font-bold leading-tight">{m.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.resumo}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.papeis.map((p) => {
                      const Icone = ICONE_PAPEL[p];
                      return (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                        >
                          <Icone aria-hidden className="h-3 w-3" /> {p}
                        </span>
                      );
                    })}
                  </div>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => baixar(nomeArquivo(m.arquivo), moduloMd(m))}
                >
                  <DownloadSimple aria-hidden className="h-4 w-4" /> Baixar
                </Button>
              </div>

              {on && (
                <div className="space-y-6 border-t border-border bg-muted/20 p-5">
                  {m.secoes.map((s) => (
                    <SecaoView key={s.id} secao={s} />
                  ))}
                  {m.anexoMd && (
                    <p className="text-sm text-muted-foreground">
                      Este módulo também traz os prompts completos de cada papel — veja
                      na aba <b>Papéis e prompts</b>.
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Papéis ─────────────────────────── */

function Papeis() {
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiar(id: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cole o prompt na configuração do agente e anexe os módulos marcados para
        ele. O formato da entrega é o que transforma resposta em coisa usável.
      </p>

      {PAPEIS.map((p) => {
        const Icone = ICONE_PAPEL[p.id];
        return (
          <Card key={p.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icone aria-hidden className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold leading-tight">{p.nome}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.missao}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt de sistema
                </p>
                <Button variant="outline" size="sm" onClick={() => copiar(p.id, p.prompt)}>
                  {copiado === p.id ? (
                    <Check aria-hidden className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy aria-hidden className="h-4 w-4" />
                  )}
                  {copiado === p.id ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <pre
                className={cn(
                  "max-h-64 overflow-auto rounded-[var(--radius)] border border-border bg-muted/40 p-3",
                  "whitespace-pre-wrap font-mono text-xs leading-relaxed",
                )}
              >
                {p.prompt}
              </pre>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Formato da entrega
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
                {p.contratoSaida.map((c, i) => (
                  <li key={i}>
                    <Inline md={c} />
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
