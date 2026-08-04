import type { Secao } from "./tipos";

/**
 * O que o Zulan é e o que ele faz — o inventário factual.
 *
 * Esta é a base contra a qual o agente confere qualquer afirmação sobre o
 * produto. Só entra aqui o que existe e está no ar. Recurso planejado vive na
 * aba Atualizações do painel do salão, não aqui — misturar os dois é como o
 * agente acaba anunciando o que ainda não foi construído.
 */
export const PRODUTO: Secao[] = [
  {
    id: "o-que-e",
    rotulo: "O que é",
    titulo: "O que é o Zulan",
    subtitulo: "A definição de uma linha, e o que ela exclui.",
    blocos: [
      {
        tipo: "texto",
        md: "O Zulan é um **sistema de agendamento e gestão para salões de beleza, barbearias e clínicas de estética no Brasil**. Funciona pelo navegador, no celular e no computador, sem instalação. Cada salão tem um **link público próprio** onde a cliente escolhe serviço, profissional e horário sozinha, e o agendamento cai direto na agenda do salão já confirmado.",
      },
      {
        tipo: "texto",
        md: "O produto é **multi-inquilino**: cada salão enxerga apenas os próprios dados, com isolamento aplicado no banco e permissões por cargo. É de assinatura mensal, com **14 dias de teste grátis sem cartão de crédito**.",
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**O que o Zulan NÃO é**, e o agente não deve sugerir que seja: não é maquininha nem meio de pagamento (não processa cartão da cliente final); não é emissor de nota fiscal; não é marketplace nem diretório de salões (a cliente não descobre salões dentro dele); não é aplicativo de loja (é web, e instalável como PWA).",
      },
    ],
  },

  {
    id: "cliente-final",
    rotulo: "Para a cliente",
    titulo: "O que a cliente do salão faz",
    subtitulo: "O lado público — o que acontece no link que a dona divulga.",
    blocos: [
      {
        tipo: "lista",
        titulo: "No link do salão, sem baixar nada e sem criar conta:",
        itens: [
          "Escolhe um ou mais serviços, vê preço e duração.",
          "Escolhe a profissional — ou marca **\"Sem preferência\"**, e o sistema atribui quem tiver o horário livre.",
          "Vê os horários realmente disponíveis, calculados pela duração dos serviços e pela agenda de cada profissional.",
          "Se identifica com nome e celular e confirma. O celular é validado como número brasileiro real.",
          "Entra na **lista de espera** quando não há horário no dia que queria.",
          "Consulta e acompanha os próprios agendamentos.",
          "Escolhe **fotos de inspiração** na galeria do salão, que aparecem para a profissional na agenda.",
          "Preenche a **ficha de anamnese** quando o salão usa (alergias, condições de saúde, histórico).",
          "Pede **atendimento em domicílio**, quando o salão oferece — com cálculo de taxa de deslocamento por distância.",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**A página pública é otimizada para busca**: cada salão tem título, descrição e dados estruturados de negócio local com bairro e cidade, respeitando a visibilidade de endereço que a dona escolheu. É por ela que uma busca como \"salão de beleza no [bairro]\" pode chegar ao salão.",
      },
    ],
  },

  {
    id: "areas",
    rotulo: "Áreas do painel",
    titulo: "O que a dona do salão tem no painel",
    subtitulo: "Inventário das áreas que existem e estão no ar.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "Agenda",
            linhas: [{ md: "Visões de dia, semana e mês. Criar e remarcar atendimento, bloquear horário, marcar chegada, falta e conclusão. Sinaliza atrasos e pendências do dia." },
            ],
          },
          {
            titulo: "Clientes",
            linhas: [{ md: "Ficha com histórico, total gasto, ticket médio, faltas, cancelamentos e profissional favorita. Anamnese, foto, alerta de segurança e marcação de VIP." }],
          },
          {
            titulo: "Serviços",
            linhas: [{ md: "Preço, duração, categoria, comissão por serviço, quais profissionais executam, produtos consumidos e se pode ser feito em domicílio." }],
          },
          {
            titulo: "Equipe",
            linhas: [{ md: "Profissionais, cargos (gerente, profissional, recepção), permissões por cargo, horários individuais, comissão e aluguel de cadeira." }],
          },
          {
            titulo: "Caixa & Comissões",
            linhas: [{ md: "Abertura e fechamento de caixa, recebimento com desconto e pagamento dividido, venda de produto no balcão, movimentações, estorno e fechamento de comissão por período." }],
          },
          {
            titulo: "Estoque",
            linhas: [{ md: "Produtos de uso e de revenda, entrada e saída, baixa automática dos insumos ao concluir o atendimento e aviso de estoque negativo." }],
          },
          {
            titulo: "Pacotes",
            linhas: [{ md: "Modelos de pacote (ex.: 4 manicures), venda para a cliente, consumo de sessão e controle de validade." }],
          },
          {
            titulo: "Campanhas",
            linhas: [{ md: "Descontos por serviço com período de validade, que aparecem na página pública de agendamento." }],
          },
          {
            titulo: "Recuperar",
            linhas: [{ md: "Listas de quem faltou, cancelou ou sumiu, com mensagem pronta e envio pelo WhatsApp do salão, respeitando o limite de frequência." }],
          },
          {
            titulo: "Relatórios",
            linhas: [{ md: "Financeiro, desempenho por serviço e por profissional, temperatura da base e reativação." }],
          },
          {
            titulo: "Galeria",
            linhas: [{ md: "Fotos dos trabalhos, exibidas na página pública e usadas como inspiração pela cliente ao agendar." }],
          },
          {
            titulo: "Configurações",
            linhas: [{ md: "Dados e endereço, horários de funcionamento, link público, regras de agendamento, domicílio, cores e tipografia por segmento, acessos por cargo, WhatsApp, assinatura e atualizações do produto." }],
          },
        ],
      },
    ],
  },

  {
    id: "diferenciais",
    rotulo: "Diferenciais",
    titulo: "O que é incomum no Zulan",
    subtitulo: "Os pontos que sustentam o posicionamento — e que são verificáveis.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "Demonstração aberta, sem cadastro",
            linhas: [
              { md: "`/demo/salao` e `/demo/barbearia` entram direto num salão completo, com agenda cheia, caixa aberto e dados realistas." },
              { rotulo: "Por que importa", md: "É o ativo de prova mais forte que existe hoje. Remove todo o atrito entre o interesse e ver o produto funcionando." },
            ],
          },
          {
            titulo: "Identidade visual por segmento",
            linhas: [
              { md: "Barbearia, salão feminino, estética e neutro têm tipografia e paleta próprias, com 12 variações de cor." },
              { rotulo: "Por que importa", md: "A página pública parece do salão, não de um sistema genérico." },
            ],
          },
          {
            titulo: "Atendimento em domicílio com taxa por distância",
            linhas: [
              { md: "Calcula a taxa pela distância real, respeita raio máximo e pede confirmação da cliente antes de fechar o horário." },
              { rotulo: "Por que importa", md: "Resolve um caso que a maioria dos sistemas ignora, e que é comum entre autônomas." },
            ],
          },
          {
            titulo: "WhatsApp com freio de mão",
            linhas: [
              { md: "Confirmação e lembrete automáticos, com opção de sair e **limite de 4 mensagens por semana por cliente**." },
              { rotulo: "Por que importa", md: "O limite protege o número do salão de bloqueio. É decisão de produto, não limitação técnica." },
            ],
          },
          {
            titulo: "Comissão que fecha sozinha",
            linhas: [
              { md: "Percentual por serviço e por profissional, calculado na conclusão do atendimento e fechado por período." },
              { rotulo: "Por que importa", md: "É a dor que mais gera atrito dentro do salão, e quase sempre resolvida na calculadora." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "limites",
    rotulo: "Limites",
    titulo: "Limites conhecidos — o que dizer quando perguntarem",
    subtitulo: "Responder isto com honestidade converte mais do que desconversar.",
    blocos: [
      {
        tipo: "lista",
        itens: [
          "**Não processa pagamento da cliente final.** O caixa registra como foi pago (dinheiro, pix, cartão); a cobrança em si acontece fora do sistema. A assinatura do salão, essa sim, é cobrada pelo Asaas.",
          "**Não emite nota fiscal.**",
          "**A integração com WhatsApp está no plano Max, marcado como em breve.** O envio automático depende dessa conexão.",
          "**Não tem aplicativo em loja.** É web e instalável como atalho no celular (PWA), com notificação push.",
          "**Não importa dados de outro sistema automaticamente.** A migração é feita a mão — e é justamente por isso que a montagem assistida é o argumento de venda.",
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "**Como usar um limite a favor:** \"não importa do outro sistema\" vira \"eu sento com você e monto junto\". O limite técnico é o que cria a oportunidade de presença — que é exatamente o diferencial da estratégia.",
      },
    ],
  },
];
