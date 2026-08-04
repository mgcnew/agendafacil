"use client";

import { Card } from "@/components/ui";
import type { Bloco, Secao, TomNota } from "@/lib/agentes";
import {
  CheckCircle,
  Lightbulb,
  Quotes,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Renderiza os blocos da base de conhecimento como JSX.
 *
 * O mesmo conteúdo que o `markdown.ts` transforma em arquivo para os agentes.
 * Ter os dois renderizadores lendo a mesma fonte é o que garante que o que
 * você lê na tela é exatamente o que o agente recebe — sem isso, a divergência
 * aparece justamente quando importa, no meio de uma conversa de venda.
 */

/**
 * Markdown de linha: `**negrito**`, `*itálico*` e `` `código` ``.
 *
 * Um analisador completo seria peso morto: o conteúdo é escrito por uma pessoa
 * só, que conhece as três marcações. O que importa é não engolir o texto em
 * silêncio quando a marcação estiver malformada — daí a divisão por captura,
 * que preserva tudo o que não casar.
 */
export function Inline({ md }: { md: string }) {
  const partes = md.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {partes.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
          return <b key={i}>{p.slice(2, -2)}</b>;
        }
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono">
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
          return <i key={i}>{p.slice(1, -1)}</i>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

const TOM: Record<TomNota, { cls: string; ic: string; Icon: typeof Lightbulb }> = {
  info: { cls: "bg-primary/8 border-primary/25", ic: "text-primary", Icon: Lightbulb },
  ganho: { cls: "bg-emerald-500/8 border-emerald-500/25", ic: "text-emerald-600", Icon: CheckCircle },
  alerta: { cls: "bg-amber-500/10 border-amber-500/30", ic: "text-amber-600", Icon: WarningCircle },
};

function BlocoView({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case "texto":
      return (
        <p className="text-sm leading-relaxed">
          <Inline md={bloco.md} />
        </p>
      );

    case "nota": {
      const { cls, ic, Icon } = TOM[bloco.tom];
      return (
        <div className={`flex gap-3 rounded-[var(--radius)] border p-4 ${cls}`}>
          <Icon aria-hidden className={`h-5 w-5 shrink-0 mt-0.5 ${ic}`} />
          <div className="text-sm leading-relaxed">
            <Inline md={bloco.md} />
          </div>
        </div>
      );
    }

    case "lista":
      return (
        <div className="space-y-2">
          {bloco.titulo && <p className="text-sm font-semibold">{bloco.titulo}</p>}
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {bloco.itens.map((it, i) => (
              <li key={i}>
                <Inline md={it} />
              </li>
            ))}
          </ul>
        </div>
      );

    case "cartoes":
      return (
        <div className="space-y-3">
          {bloco.titulo && <p className="text-sm font-semibold">{bloco.titulo}</p>}
          {bloco.itens.map((c) => (
            <Card key={c.titulo} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  <Inline md={c.titulo} />
                </p>
                {c.selo && (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {c.selo}
                  </span>
                )}
              </div>
              {c.linhas.map((l, i) => (
                <p key={i} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {l.rotulo && <b className="text-foreground">{l.rotulo}: </b>}
                  <Inline md={l.md} />
                </p>
              ))}
            </Card>
          ))}
        </div>
      );

    case "fala":
      return (
        <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Quotes aria-hidden className="h-3.5 w-3.5" />
            {bloco.rotulo}
          </div>
          <p className="text-sm italic leading-relaxed text-foreground/90">
            &ldquo;<Inline md={bloco.md} />&rdquo;
          </p>
        </div>
      );

    case "tabela":
      return (
        <div className="space-y-2">
          {bloco.titulo && <p className="text-sm font-semibold">{bloco.titulo}</p>}
          <Card className="overflow-hidden p-0">
            {/* A tabela rola sozinha no celular — sem isto, a página inteira
                ganha rolagem lateral por causa de uma coluna comprida. */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    {bloco.colunas.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-2.5 text-left font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.linhas.map((linha, i) => (
                    <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                      {linha.map((celula, j) => (
                        <td
                          key={j}
                          className={`px-4 py-2.5 align-top ${j === 0 ? "font-medium" : "text-muted-foreground"}`}
                        >
                          <Inline md={celula} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      );

    case "fases":
      return (
        <div className="space-y-4">
          {bloco.itens.map((f, i) => (
            <Card key={f.fase} className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                  {i}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{f.fase}</p>
                  <p className="font-display font-bold leading-tight">{f.titulo}</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {f.itens.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm">
                    <CheckCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      <Inline md={it} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      );
  }
}

export function SecaoView({ secao, mostrarTitulo = true }: { secao: Secao; mostrarTitulo?: boolean }) {
  return (
    <div className="space-y-5">
      {mostrarTitulo && (
        <div>
          <h2 className="font-display text-xl font-bold leading-tight">{secao.titulo}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{secao.subtitulo}</p>
        </div>
      )}
      {secao.blocos.map((b, i) => (
        <BlocoView key={i} bloco={b} />
      ))}
    </div>
  );
}
