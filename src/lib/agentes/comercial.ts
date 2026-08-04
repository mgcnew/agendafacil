import type { Secao } from "./tipos";

/**
 * Comercial — o processo de venda e o que é negociável.
 *
 * A estratégia (porta a porta, objeções, ancoragem) vive no módulo de
 * estratégia. Aqui fica o que um agente comercial precisa para **decidir**:
 * até onde pode ir no desconto, quando desistir de um lead, o que prometer.
 * Sem isso ele inventa condição comercial — e condição inventada vira
 * expectativa que você precisa honrar.
 */
export const COMERCIAL: Secao[] = [
  {
    id: "funil",
    rotulo: "Funil",
    titulo: "As etapas, e o que faz avançar cada uma",
    subtitulo: "O gargalo quase nunca é onde parece.",
    blocos: [
      {
        tipo: "tabela",
        colunas: ["Etapa", "O que a faz avançar", "Erro comum"],
        linhas: [
          ["Contato", "Chegar em horário morto do salão e pedir 2 minutos", "Ir no pico e ser dispensado sem ouvir"],
          ["Descoberta", "Deixar a dona falar a dor antes de falar do produto", "Apresentar o sistema inteiro sem saber o que dói"],
          ["Demonstração", "Mostrar só as 1–2 dores dela, ao vivo, no celular", "Passeio por todas as telas"],
          ["Trial", "Montar o salão na hora, junto com ela", "Mandar o link e deixar ela se virar"],
          ["Adoção", "Acompanhar D+1, D+3, D+7, D+12", "Sumir e reaparecer no dia da cobrança"],
          ["Pagante", "A conversa acontece com o sistema já em uso", "Pedir a decisão antes de ela ter usado"],
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**O gargalo real é a adoção, não o fechamento.** Trial que nunca criou um agendamento quase nunca vira pagante. Um agente comercial que só otimiza abordagem está trabalhando no lugar errado do funil.",
      },
    ],
  },

  {
    id: "condicoes",
    rotulo: "Condições",
    titulo: "O que é negociável e o que não é",
    subtitulo: "Limites explícitos para o agente não inventar condição comercial.",
    blocos: [
      {
        tipo: "lista",
        titulo: "Fixo — não pode ser alterado por nenhum agente:",
        itens: [
          "**Preço de tabela:** Básico R$ 39,90, Pro R$ 69,90, Max R$ 99,90 (em breve, não vendável).",
          "**Teste de 14 dias, sem cartão.** Não estenda, não encurte, não peça cartão.",
          "**Não existe plano anual, vitalício, gratuito permanente nem \"pague o que quiser\".**",
          "**Não existe contrato de fidelidade nem multa de cancelamento.**",
        ],
      },
      {
        tipo: "lista",
        titulo: "Negociável — mas só o Marcelo aprova, caso a caso:",
        itens: [
          "Desconto de lançamento para os primeiros salões do bairro.",
          "Valor travado (\"seguro esse preço pra você\") em troca de depoimento ou indicação.",
          "Extensão pontual do teste para quem começou a usar e teve um imprevisto.",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Regra do desconto:** desconto se troca por algo — depoimento, indicação, ser o primeiro do bairro. Desconto dado só para fechar ensina que o preço era mentira, e a próxima conversa começa pedindo mais.",
      },
    ],
  },

  {
    id: "descarte",
    rotulo: "Quando desistir",
    titulo: "Quando parar de investir num lead",
    subtitulo: "Tempo é o recurso escasso. Saber sair é tão importante quanto saber entrar.",
    blocos: [
      {
        tipo: "lista",
        titulo: "Encerre e registre o motivo:",
        itens: [
          "Sem resposta após **3 tentativas** espaçadas (mesmo dia, +3 dias, +1 semana).",
          "Trial expirado **sem nenhum agendamento criado** e sem resposta ao acompanhamento.",
          "Disse não de forma clara. Volte em 3 meses, não em 3 dias.",
          "Perfil fora do alvo (rede, franquia, dono ausente). Registre e siga.",
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "**Nunca saia de mãos vazias:** mesmo em \"não\", peça o WhatsApp e a indicação de outro salão. Quem não compra costuma conhecer quem compra.",
      },
    ],
  },
];
