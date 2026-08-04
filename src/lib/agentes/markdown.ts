import type { Bloco, Modulo, Papel, Secao, TomNota } from "./tipos";

/**
 * Blocos → markdown.
 *
 * O destino é um modelo de linguagem, não um leitor humano, e isso muda duas
 * decisões: os títulos viram hierarquia real (`##`, `###`) porque é assim que
 * o modelo entende escopo; e os avisos ganham um prefixo textual em vez de cor,
 * porque cor não sobrevive ao texto puro.
 */

const PREFIXO_NOTA: Record<TomNota, string> = {
  info: "**Importante:**",
  ganho: "**A favor:**",
  alerta: "**Atenção:**",
};

function blocoMd(b: Bloco): string {
  switch (b.tipo) {
    case "texto":
      return b.md;

    case "nota":
      // Citação para o bloco se destacar do corpo mesmo em texto puro.
      return `> ${PREFIXO_NOTA[b.tom]} ${b.md.replace(/\n/g, "\n> ")}`;

    case "lista": {
      const itens = b.itens.map((i) => `- ${i}`).join("\n");
      return b.titulo ? `${b.titulo}\n\n${itens}` : itens;
    }

    case "cartoes": {
      const itens = b.itens
        .map((c) => {
          const selo = c.selo ? ` _(${c.selo})_` : "";
          const linhas = c.linhas
            .map((l) => (l.rotulo ? `  - **${l.rotulo}:** ${l.md}` : `  - ${l.md}`))
            .join("\n");
          return `- **${c.titulo}**${selo}\n${linhas}`;
        })
        .join("\n\n");
      return b.titulo ? `${b.titulo}\n\n${itens}` : itens;
    }

    case "fala":
      return `**${b.rotulo}**\n\n> "${b.md}"`;

    case "tabela": {
      const cab = `| ${b.colunas.join(" | ")} |`;
      const sep = `| ${b.colunas.map(() => "---").join(" | ")} |`;
      const corpo = b.linhas.map((l) => `| ${l.join(" | ")} |`).join("\n");
      const tabela = [cab, sep, corpo].join("\n");
      return b.titulo ? `**${b.titulo}**\n\n${tabela}` : tabela;
    }

    case "fases":
      return b.itens
        .map((f) => `**${f.fase} — ${f.titulo}**\n\n${f.itens.map((i) => `- ${i}`).join("\n")}`)
        .join("\n\n");
  }
}

function secaoMd(s: Secao): string {
  return [`## ${s.titulo}`, `_${s.subtitulo}_`, ...s.blocos.map(blocoMd)].join("\n\n");
}

/** Um módulo completo, pronto para virar arquivo. */
export function moduloMd(m: Modulo): string {
  const aviso = m.gerado
    ? "\n> **Arquivo gerado a partir do sistema.** Não edite à mão — o conteúdo é lido do produto e do painel no momento do download.\n"
    : "";
  return [
    `# ${m.titulo}`,
    `> ${m.resumo}`,
    aviso,
    ...m.secoes.map(secaoMd),
    m.anexoMd ?? "",
    "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** O papel do agente como arquivo — prompt e contrato prontos para colar. */
export function papelMd(p: Papel): string {
  return [
    `## ${p.nome}`,
    `**Missão:** ${p.missao}`,
    "",
    "### Prompt de sistema",
    "",
    "```",
    p.prompt,
    "```",
    "",
    "### Formato da entrega",
    "",
    "Toda resposta deve conter estas partes, nesta ordem:",
    "",
    ...p.contratoSaida.map((c, i) => `${i + 1}. ${c}`),
  ].join("\n");
}

/**
 * Junta módulos num arquivo só.
 *
 * Serve para quem prefere colar tudo de uma vez. A separação por `---` e o
 * cabeçalho de cada módulo mantêm a fronteira legível para o modelo — um
 * despejo sem marcação vira uma massa em que ele não distingue o que é regra
 * do que é exemplo.
 */
export function pacoteMd(modulos: Modulo[], titulo: string, intro: string): string {
  const sumario = modulos
    .map((m, i) => `${i + 1}. **${m.titulo}** — ${m.resumo}`)
    .join("\n");

  return [
    `# ${titulo}`,
    "",
    intro,
    "",
    "## O que tem aqui dentro",
    "",
    sumario,
    "",
    "---",
    "",
    modulos.map(moduloMd).join("\n---\n\n"),
  ].join("\n");
}

/** Nome de arquivo seguro, sem acento nem espaço. */
export function nomeArquivo(base: string): string {
  return `${base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}.md`;
}
