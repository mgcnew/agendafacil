/**
 * Base de conhecimento do Zulan — fonte única.
 *
 * O mesmo conteúdo alimenta duas saídas que não podem divergir:
 *   • o Playbook (/admin), lido por gente, na rua, no celular;
 *   • o pacote `.md` baixado para alimentar agentes de IA.
 *
 * Antes isto vivia dentro do JSX do Playbook. Quando o posicionamento mudasse,
 * teria que mudar em dois lugares — e o que o agente diz ao mercado passaria a
 * contradizer o que você fala na porta do salão.
 *
 * O texto é escrito num subconjunto mínimo de markdown (`**negrito**` e
 * `*itálico*`) porque é a única notação que serve aos dois destinos sem
 * conversão: o painel renderiza como JSX, o arquivo sai como markdown puro.
 */

/** Peso visual de um aviso. No markdown vira um prefixo em negrito. */
export type TomNota = "info" | "ganho" | "alerta";

export type Bloco =
  /** Parágrafo corrido. */
  | { tipo: "texto"; md: string }
  /** Destaque — a regra, o cuidado, o atalho. */
  | { tipo: "nota"; tom: TomNota; md: string }
  /** Lista de itens. `titulo` vira uma linha de introdução. */
  | { tipo: "lista"; titulo?: string; itens: string[] }
  /**
   * Cartões — um conceito por bloco, com rótulo e linhas nomeadas.
   * É o formato que mais aparece no Playbook (públicos, concorrentes,
   * gatilhos, objeções) e o que melhor vira lista no markdown.
   */
  | {
      tipo: "cartoes";
      titulo?: string;
      itens: {
        titulo: string;
        selo?: string;
        /** Cada linha é um par rótulo/valor: "Por quê" → "…". */
        linhas: { rotulo?: string; md: string }[];
      }[];
    }
  /** Fala pronta, para repetir quase literalmente. */
  | { tipo: "fala"; rotulo: string; md: string }
  /** Tabela simples. Primeira coluna é o rótulo da linha. */
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] }
  /** Etapas numeradas de um processo. */
  | { tipo: "fases"; itens: { fase: string; titulo: string; itens: string[] }[] };

export type Secao = {
  id: string;
  /** Rótulo curto, para a navegação. */
  rotulo: string;
  titulo: string;
  subtitulo: string;
  blocos: Bloco[];
};

/**
 * Um módulo é um arquivo `.md` baixável.
 *
 * A granularidade é proposital: um agente de tráfego pago não precisa saber
 * como funciona a baixa de estoque, e um agente de suporte não precisa do
 * roteiro de porta a porta. Contexto que não serve não é neutro — ele dilui a
 * atenção do modelo e encarece cada chamada.
 */
export type Modulo = {
  id: string;
  /** Nome do arquivo gerado, sem extensão. O prefixo numérico define a ordem. */
  arquivo: string;
  titulo: string;
  /** Uma linha: o que este módulo responde. Vai para o manifesto. */
  resumo: string;
  /** Para quais papéis de agente este módulo é obrigatório. */
  papeis: PapelId[];
  /** `true` quando o conteúdo é derivado do sistema, não escrito à mão. */
  gerado?: boolean;
  secoes: Secao[];
  /**
   * Markdown pronto, anexado depois das seções. Existe para o módulo de
   * papéis, cujo corpo são prompts em bloco de código — algo que o modelo de
   * blocos não representa e não deveria representar, porque é conteúdo para
   * copiar literalmente, não para diagramar.
   */
  anexoMd?: string;
};

export type PapelId =
  | "marketing"
  | "comercial"
  | "suporte"
  | "manutencao";

export type Papel = {
  id: PapelId;
  nome: string;
  /** O que este agente faz, em uma linha. */
  missao: string;
  /** Prompt de sistema pronto para colar. */
  prompt: string;
  /** O formato exato que ele deve devolver — sem isto a resposta vem em prosa. */
  contratoSaida: string[];
};
