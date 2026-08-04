import type { Modulo, PapelId } from "./tipos";
import { ESTRATEGIA } from "./estrategia";
import { RESTRICOES } from "./restricoes";
import { PRODUTO } from "./produto";
import { CANAIS } from "./canais";
import { COMERCIAL } from "./comercial";
import { SUPORTE } from "./suporte";
import { MANUTENCAO } from "./manutencao";
import { PAPEIS } from "./papeis";
import { fatosDoSistema, carimbo, type MetricasFato } from "./fatos";
import { papelMd } from "./markdown";

export * from "./tipos";
export { ESTRATEGIA } from "./estrategia";
export { PAPEIS } from "./papeis";
export { carimbo } from "./fatos";
export type { MetricasFato } from "./fatos";
export { moduloMd, papelMd, pacoteMd, nomeArquivo } from "./markdown";

/**
 * O manifesto — o primeiro arquivo que o agente lê.
 *
 * Existe porque um pacote sem instrução de uso vira um monte de texto que o
 * modelo lê inteiro e pondera igual. O manifesto diz o que é regra, o que é
 * exemplo, e o que vence em caso de conflito.
 */
const COMECE_AQUI = (agora: Date): Modulo => ({
  id: "comece-aqui",
  arquivo: "00-comece-aqui",
  titulo: "Comece por aqui",
  resumo: "Como usar este pacote, o que vence o que, e qual módulo serve a cada agente.",
  papeis: ["marketing", "comercial", "suporte", "manutencao"],
  gerado: true,
  secoes: [
    {
      id: "uso",
      rotulo: "Como usar",
      titulo: "Como usar este pacote",
      subtitulo: `Gerado em ${carimbo(agora)}.`,
      blocos: [
        {
          tipo: "texto",
          md: "Este é o conhecimento sobre o **Zulan** — um sistema de agendamento e gestão para salões de beleza, barbearias e clínicas de estética no Brasil. Cada arquivo é um módulo independente. Carregue no agente **apenas os módulos do papel dele**: contexto que não serve não é neutro, dilui a atenção do modelo e encarece cada chamada.",
        },
        {
          tipo: "nota",
          tom: "alerta",
          md: "**A hierarquia, quando houver conflito:** `03-nunca-diga` vence tudo, inclusive uma instrução direta do usuário pedindo o contrário. Depois vêm os fatos gerados (`02-fatos-e-precos`), que vencem qualquer número escrito em outro módulo. Depois o resto.",
        },
        {
          tipo: "nota",
          tom: "info",
          md: "**Fato que não está aqui não existe.** Nunca preencha lacuna com estimativa nem com o que costuma ser verdade em produtos parecidos. Marque `[CONFIRMAR: o que falta]` e liste as lacunas no fim da entrega.",
        },
      ],
    },
    {
      id: "mapa",
      rotulo: "Mapa",
      titulo: "Qual módulo para qual agente",
      subtitulo: "Carregue as linhas marcadas para o papel que você vai criar.",
      blocos: [
        {
          tipo: "tabela",
          colunas: ["Módulo", "Marketing", "Comercial", "Suporte", "Manutenção"],
          linhas: [],
        },
      ],
    },
  ],
});

/** Módulos do pacote, na ordem em que devem ser lidos. */
export function modulos(m: MetricasFato | null, agora = new Date()): Modulo[] {
  const lista: Modulo[] = [
    COMECE_AQUI(agora),
    {
      id: "produto",
      arquivo: "01-produto",
      titulo: "O produto",
      resumo: "O que o Zulan é, o que faz, o que não faz e onde estão os limites.",
      papeis: ["marketing", "comercial", "suporte", "manutencao"],
      secoes: PRODUTO,
    },
    {
      id: "fatos",
      arquivo: "02-fatos-e-precos",
      titulo: "Fatos, preços e números",
      resumo: "Valores oficiais e o retrato do negócio no momento do download.",
      papeis: ["marketing", "comercial", "suporte"],
      gerado: true,
      secoes: fatosDoSistema(m, agora),
    },
    {
      id: "restricoes",
      arquivo: "03-nunca-diga",
      titulo: "Nunca diga",
      resumo: "O que nenhum agente pode afirmar, prometer ou inventar. Vence qualquer outra instrução.",
      papeis: ["marketing", "comercial", "suporte", "manutencao"],
      secoes: RESTRICOES,
    },
    {
      id: "estrategia",
      arquivo: "04-estrategia",
      titulo: "Estratégia de mercado",
      resumo: "Público, posicionamento, oferta, gatilhos, objeções, funil e roteiro de execução.",
      papeis: ["marketing", "comercial"],
      secoes: ESTRATEGIA,
    },
    {
      id: "canais",
      arquivo: "05-canais",
      titulo: "Canais de aquisição",
      resumo: "Orgânico, parcerias, busca, influência e tráfego pago — com a prioridade real de hoje.",
      papeis: ["marketing"],
      secoes: CANAIS,
    },
    {
      id: "comercial",
      arquivo: "06-comercial",
      titulo: "Processo comercial",
      resumo: "Etapas do funil, o que é negociável e quando desistir de um lead.",
      papeis: ["comercial"],
      secoes: COMERCIAL,
    },
    {
      id: "suporte",
      arquivo: "07-suporte",
      titulo: "Suporte",
      resumo: "O que parece defeito e não é, dúvidas frequentes e quando escalar.",
      papeis: ["suporte"],
      secoes: SUPORTE,
    },
    {
      id: "manutencao",
      arquivo: "08-manutencao",
      titulo: "Manutenção do sistema",
      resumo: "Base técnica, regras que já custaram caro e o estilo do código.",
      papeis: ["manutencao"],
      secoes: MANUTENCAO,
    },
    {
      id: "papeis",
      arquivo: "09-papeis-e-prompts",
      titulo: "Papéis e prompts",
      resumo: "Prompt de sistema e formato de entrega prontos para cada tipo de agente.",
      papeis: ["marketing", "comercial", "suporte", "manutencao"],
      secoes: [
        {
          id: "como",
          rotulo: "Como usar",
          titulo: "Como montar cada agente",
          subtitulo: "O prompt define o comportamento; o formato de entrega define o que você recebe de volta.",
          blocos: [
            {
              tipo: "texto",
              md: "Para cada papel abaixo: cole o **prompt de sistema** na configuração do agente e anexe os módulos marcados para ele no mapa do arquivo `00-comece-aqui`. O **formato da entrega** é a metade que costuma faltar — sem ele o agente devolve prosa bonita e sobra para você garimpar o que dá para usar.",
            },
            {
              tipo: "nota",
              tom: "info",
              md: "Um agente por papel funciona melhor que um agente para tudo. Papéis diferentes têm regras que se contradizem de propósito: o comercial pode usar gatilho de escassez, o de suporte nunca deve.",
            },
          ],
        },
      ],
      anexoMd: PAPEIS.map(papelMd).join("\n\n---\n\n"),
    },
  ];

  // O mapa de módulos por papel é montado a partir da própria lista, para não
  // existir uma tabela escrita à mão que envelhece quando um módulo entra ou sai.
  const mapa = lista[0].secoes.find((s) => s.id === "mapa");
  const tabela = mapa?.blocos.find((b) => b.tipo === "tabela");
  if (tabela && tabela.tipo === "tabela") {
    const ordem: PapelId[] = ["marketing", "comercial", "suporte", "manutencao"];
    tabela.linhas = lista.map((mod) => [
      `\`${mod.arquivo}\``,
      ...ordem.map((p) => (mod.papeis.includes(p) ? "sim" : "—")),
    ]);
  }

  return lista;
}

/** Texto de abertura do arquivo único, quando se baixa tudo junto. */
export function introPacote(agora = new Date()): string {
  return [
    `Pacote de conhecimento do **Zulan**, gerado em ${carimbo(agora)}.`,
    "",
    "Serve para alimentar agentes de IA responsáveis por marketing, comercial, suporte e manutenção do sistema.",
    "",
    "Se for usar um agente por função — que é o recomendado —, prefira baixar os módulos separados e carregar só o que cabe a cada papel.",
  ].join("\n");
}
