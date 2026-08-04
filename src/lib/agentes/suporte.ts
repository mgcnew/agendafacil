import type { Secao } from "./tipos";

/**
 * Suporte — o que responder quando a dona do salão pergunta.
 *
 * O foco são os comportamentos que **parecem defeito e não são**. É onde o
 * suporte perde mais tempo e onde um agente sem contexto responde errado com
 * mais confiança: ele vê "a mensagem não chegou" e abre um chamado de bug,
 * quando na verdade o sistema silenciou de propósito.
 */
export const SUPORTE: Secao[] = [
  {
    id: "postura",
    rotulo: "Postura",
    titulo: "Como responder",
    subtitulo: "Quem escreve para o suporte está com cliente na cadeira esperando.",
    blocos: [
      {
        tipo: "lista",
        itens: [
          "**Responda a pergunta primeiro**, explique depois. Ninguém quer contexto antes da resposta.",
          "**Diga onde fica**, com o caminho: \"Configurações → Horários\". Não descreva o botão.",
          "**Nunca diga que algo é simples.** Se a pessoa perguntou, não foi.",
          "**Se for defeito, admita e diga o prazo real** — ou diga que não tem prazo. Não invente previsão.",
          "**Se envolver dinheiro do salão** (caixa, comissão, cobrança), não improvise: escale.",
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Escale para o Marcelo, sem tentar resolver:** qualquer coisa sobre cobrança e assinatura; suspeita de dado errado ou perdido; pedido de exclusão de conta ou de dados; e qualquer coisa que envolva mais de um salão ao mesmo tempo.",
      },
    ],
  },

  {
    id: "nao-e-bug",
    rotulo: "Parece bug",
    titulo: "Comportamentos que parecem defeito e não são",
    subtitulo: "Cada um destes é decisão de produto. Responder \"vou verificar\" aqui é perder confiança à toa.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "\"A mensagem automática não foi enviada\"",
            linhas: [
              {
                rotulo: "Por quê",
                md: "O envio é silencioso por decisão em três casos: o salão não tem WhatsApp conectado; a cliente pediu para não receber; ou já foram **4 mensagens naquela semana** para aquela cliente.",
              },
              {
                rotulo: "O que dizer",
                md: "Explique o limite como proteção: é o que evita o número do salão ser bloqueado por excesso de envio. Confira primeiro qual dos três casos é.",
              },
            ],
          },
          {
            titulo: "\"O valor esperado do caixa está errado\"",
            linhas: [
              {
                rotulo: "Por quê",
                md: "O valor esperado conta **apenas dinheiro em espécie** — não soma cartão nem pix, que não estão na gaveta.",
              },
              { rotulo: "O que dizer", md: "É o valor que deve estar fisicamente no caixa na hora de fechar. Cartão e pix aparecem nas movimentações e nos relatórios." },
            ],
          },
          {
            titulo: "\"Concluí o atendimento e o valor não apareceu no faturamento\"",
            linhas: [
              {
                rotulo: "Por quê",
                md: "A receita só entra no caixa se houver **caixa aberto** no momento da conclusão. Com o caixa fechado, o atendimento conclui e o valor não é lançado.",
              },
              { rotulo: "O que dizer", md: "Hoje o sistema avisa na hora quando isso acontece. Se passou batido, o caminho é abrir o caixa e lançar o recebimento pelo Financeiro." },
            ],
          },
          {
            titulo: "\"A cliente não consegue escolher um horário que está livre\"",
            linhas: [
              {
                rotulo: "Por quê",
                md: "O horário disponível considera a duração somada de todos os serviços escolhidos, o horário de trabalho daquela profissional e os bloqueios. Um vão de 30 minutos não aparece para um serviço de 1 hora.",
              },
              { rotulo: "O que dizer", md: "Peça para conferir a duração cadastrada dos serviços e o horário individual da profissional em Equipe." },
            ],
          },
          {
            titulo: "\"O atendimento a domicílio ficou aguardando confirmação\"",
            linhas: [
              {
                rotulo: "Por quê",
                md: "Quando há taxa de deslocamento, a cliente recebe o valor e precisa responder. Se confirmar, o status vira confirmado; se recusar, vira cancelado.",
              },
              { rotulo: "O que dizer", md: "É proposital: evita a cliente descobrir a taxa só na hora do atendimento." },
            ],
          },
          {
            titulo: "\"Minha cliente disse que não recebeu o link\"",
            linhas: [
              { rotulo: "Por quê", md: "O link do salão é divulgado pela dona — o sistema não envia link de agendamento para lista de clientes." },
              { rotulo: "O que dizer", md: "Mostre onde copiar (Configurações → Agendamento) e sugira fixar no perfil do Instagram e no status do WhatsApp." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "duvidas",
    rotulo: "Dúvidas comuns",
    titulo: "Perguntas que aparecem sempre",
    subtitulo: "Respostas curtas, para reusar quase literalmente.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "\"Minha cliente precisa baixar aplicativo?\"",
            linhas: [{ rotulo: "Resposta", md: "Não. Ela abre um link, igual abrir uma mensagem. Não precisa criar conta nem instalar nada." }],
          },
          {
            titulo: "\"Preciso de cartão para testar?\"",
            linhas: [{ rotulo: "Resposta", md: "Não. São 14 dias, sem cartão. Você só paga se decidir continuar." }],
          },
          {
            titulo: "\"Meus dados são meus? E se eu sair?\"",
            linhas: [{ rotulo: "Resposta", md: "Os dados são do salão. Peça a exportação a qualquer momento pelo suporte." }],
          },
          {
            titulo: "\"Minha profissional pode ver o faturamento?\"",
            linhas: [{ rotulo: "Resposta", md: "Só se você deixar. O acesso é por cargo, em Configurações → Acessos, e dá para liberar ou bloquear cada coisa." }],
          },
          {
            titulo: "\"Consigo usar no computador e no celular?\"",
            linhas: [{ rotulo: "Resposta", md: "Nos dois, ao mesmo tempo. Dá para instalar como atalho no celular e receber notificação." }],
          },
          {
            titulo: "\"E se eu marcar pelo caderno e pelo sistema ao mesmo tempo?\"",
            linhas: [{ rotulo: "Resposta", md: "O sistema bloqueia dois atendimentos da mesma profissional no mesmo horário. O que ele não enxerga é o que ficou só no caderno — por isso vale migrar de vez, e eu ajudo nisso." }],
          },
        ],
      },
    ],
  },
];
