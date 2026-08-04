import { PLANS } from "@/lib/plans";
import type { Secao } from "./tipos";

/**
 * Os fatos que o agente não pode inventar — derivados do sistema, não escritos
 * à mão.
 *
 * É a peça que dá validade ao pacote inteiro. Um documento de marketing
 * redigido uma vez está errado na semana seguinte: o preço muda, o número de
 * salões muda, e o agente segue afirmando o antigo com toda a confiança. Aqui
 * o preço vem do catálogo real (`@/lib/plans`) e os números vêm do painel no
 * momento em que o arquivo é baixado.
 *
 * Por isso todo arquivo gerado carrega a data de emissão: um pacote velho é
 * detectável, um pacote sem data não.
 */

export type MetricasFato = {
  total: number;
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  mrr: number;
  arpu: number;
  conversion: number;
  churn_30d: number;
  new_this_month: number;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "4 de agosto de 2026, 21h30" — para o agente saber a validade do que leu. */
export function carimbo(agora = new Date()): string {
  return agora.toLocaleString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fatosDoSistema(m: MetricasFato | null, agora = new Date()): Secao[] {
  const planos = Object.values(PLANS);
  const vendaveis = planos.filter((p) => !p.comingSoon);
  const foco = PLANS.pro;

  return [
    {
      id: "validade",
      rotulo: "Validade",
      titulo: "Quando estes números foram lidos",
      subtitulo: "Fato sem data é fato sem validade.",
      blocos: [
        {
          tipo: "nota",
          tom: "alerta",
          md: `Este arquivo foi gerado em **${carimbo(agora)}**. Os números abaixo valem para esse instante. Se a conversa em que você está usando isto for muito posterior, trate-os como referência e marque \`[CONFIRMAR]\` em vez de afirmar.`,
        },
      ],
    },

    {
      id: "precos",
      rotulo: "Preços",
      titulo: "Planos e preços — os valores oficiais",
      subtitulo: "Lidos do catálogo do sistema. São estes os valores cobrados.",
      blocos: [
        {
          tipo: "tabela",
          colunas: ["Plano", "Valor mensal", "O que inclui", "Situação"],
          linhas: planos.map((p) => [
            p.name,
            brl(p.value),
            p.tagline,
            p.comingSoon ? "Em breve — NÃO vendável" : "Disponível",
          ]),
        },
        {
          tipo: "lista",
          titulo: "Regras de preço que o agente precisa respeitar:",
          itens: [
            `**Foco da venda:** ${foco.name}, ${brl(foco.value)}/mês.`,
            `**Assináveis hoje:** ${vendaveis.map((p) => p.name).join(" e ")}. Qualquer plano marcado como em breve não pode ser anunciado como disponível.`,
            "**Teste:** 14 dias, sem cartão de crédito. Não estenda nem encurte por conta própria.",
            "**Não existe** plano anual, vitalício, gratuito permanente nem fidelidade.",
            `**A conta do \"menos que um café\":** ${brl(foco.value)} ÷ 30 dias = cerca de ${brl(foco.value / 30)} por dia.`,
          ],
        },
      ],
    },

    {
      id: "numeros",
      rotulo: "Números",
      titulo: "Onde o negócio está agora",
      subtitulo: "O retrato real — inclusive quando ele é desconfortável.",
      blocos: m
        ? [
            {
              tipo: "tabela",
              colunas: ["Indicador", "Valor"],
              linhas: [
                ["Salões cadastrados", String(m.total)],
                ["Assinantes ativos", String(m.active)],
                ["Em teste grátis", String(m.trialing)],
                ["Inadimplentes", String(m.past_due)],
                ["Cancelados", String(m.canceled)],
                ["MRR", brl(m.mrr)],
                ["Ticket médio", brl(m.arpu)],
                ["Conversão de teste", `${m.conversion}%`],
                ["Churn (30 dias)", `${m.churn_30d}%`],
                ["Novos no mês", String(m.new_this_month)],
              ],
            },
            m.active === 0
              ? {
                  tipo: "nota",
                  tom: "alerta",
                  md: "**Não há nenhum assinante pagante ainda.** Isso tem consequência direta no que pode ser produzido: não existe depoimento, caso de sucesso, número de clientes nem avaliação para citar. Qualquer peça que precise de prova social precisa usar a demonstração aberta no lugar. Veja o módulo `nunca-diga`.",
                }
              : {
                  tipo: "nota",
                  tom: "info",
                  md: `Há **${m.active}** ${m.active === 1 ? "assinante ativo" : "assinantes ativos"}. Mesmo assim, só use depoimento ou nome de salão com autorização escrita — e nunca invente a fala de um cliente real.`,
                },
            {
              tipo: "nota",
              tom: "info",
              md: "**Estes números são internos.** Servem para o agente calibrar o que propor — nunca para aparecer em peça pública. Divulgar MRR ou contagem de clientes de um produto nesta fase enfraquece a venda.",
            },
          ]
        : [
            {
              tipo: "nota",
              tom: "alerta",
              md: "Os números do painel não puderam ser lidos na geração deste arquivo. Trate qualquer afirmação sobre tamanho da base, receita ou conversão como `[CONFIRMAR]`.",
            },
          ],
    },

    {
      id: "ativos",
      rotulo: "Ativos",
      titulo: "O que já existe para usar",
      subtitulo: "Links e recursos reais, verificáveis agora.",
      blocos: [
        {
          tipo: "tabela",
          colunas: ["Ativo", "Onde", "Para que serve"],
          linhas: [
            ["Demonstração — salão", "/demo/salao", "Entra direto num salão completo, sem cadastro. Principal prova."],
            ["Demonstração — barbearia", "/demo/barbearia", "Mesma coisa, com identidade de barbearia."],
            ["Página de um salão", "/[link-do-salão]", "O que a cliente final vê. Indexável por busca."],
            ["Blog", "/blog", "Base para conteúdo de busca."],
            ["Cadastro", "/criar-salao", "Início do teste de 14 dias, sem cartão."],
          ],
        },
        {
          tipo: "nota",
          tom: "ganho",
          md: "**A demonstração é o ativo mais forte que existe hoje.** Ela remove todo o atrito entre \"me interessei\" e \"vi funcionando\" — sem cadastro, sem instalação, sem vendedor. Toda peça de marketing deveria levar a ela.",
        },
      ],
    },
  ];
}
