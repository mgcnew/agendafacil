import type { Secao } from "./tipos";

/**
 * Canais de aquisição — um briefing por canal.
 *
 * Cada canal recebe: para que serve nesta fase, o que o agente precisa
 * decidir, e o que ele NÃO deve fazer. A ordem não é alfabética: é a ordem de
 * prioridade real hoje, e isso é informação para o agente. Um agente que
 * recebe "faça marketing" sem saber que tráfego pago está suspenso vai propor
 * campanha de mídia para quem não tem verba nem cliente pagante.
 */
export const CANAIS: Secao[] = [
  {
    id: "prioridade",
    rotulo: "Prioridade",
    titulo: "A ordem dos canais nesta fase",
    subtitulo: "Antes de propor qualquer coisa, saiba onde o esforço rende hoje.",
    blocos: [
      {
        tipo: "tabela",
        colunas: ["Canal", "Peso hoje", "Situação"],
        linhas: [
          ["Porta a porta", "70%", "Motor principal. Tudo o mais existe para apoiá-lo."],
          ["Prova social e indicação", "20%", "Depende do primeiro cliente pagante. Ainda não ativável."],
          ["Conteúdo orgânico", "10%", "Ativo. Vitrine e credibilidade, não fonte de venda."],
          ["Parcerias B2B2C", "oportunista", "Alto retorno por contato. Vale começar já."],
          ["SEO e blog", "longo prazo", "Ativo, resultado em meses. Custo zero."],
          ["Influência", "preparar", "Micro e local. Barato, mas exige produto com prova."],
          ["Tráfego pago", "suspenso", "Só depois de porta a porta previsível e caixa positivo."],
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Gatilho para destravar mídia paga:** porta a porta com conversão previsível **e** MRR que cubra a verba sem tirar do bolso. Antes disso, uma proposta de campanha paga é uma proposta de queimar dinheiro que não existe — o agente deve dizer isso em vez de montar a campanha.",
      },
    ],
  },

  {
    id: "organico",
    rotulo: "Orgânico",
    titulo: "Conteúdo orgânico — Instagram, TikTok, WhatsApp",
    subtitulo: "Vitrine e credibilidade. Prova que você existe e é sério.",
    blocos: [
      {
        tipo: "lista",
        titulo: "Ângulos que funcionam para este público:",
        itens: [
          "**A dor nomeada:** \"3 confusões que o caderninho causa no salão\". A dona se reconhece antes de saber que é anúncio.",
          "**Antes e depois de organização:** a bagunça do WhatsApp de um lado, a agenda do dia do outro.",
          "**Tela gravada, sem narração de vendedor:** a cliente agendando pelo link em 20 segundos.",
          "**Bastidor:** você montando o salão de alguém. É o diferencial de presença virando conteúdo.",
          "**Resposta a pergunta real:** \"e se minha cliente for mais velha?\" — a objeção respondida em vídeo trabalha por você em campo.",
        ],
      },
      {
        tipo: "lista",
        titulo: "Regras do canal:",
        itens: [
          "Cadência sustentável: 2–3 por semana, sempre, vale mais que 7 numa semana e sumir.",
          "Cada peça responde \"o que a dona ganha?\". Nunca \"que legal meu sistema\".",
          "Legenda em português de balcão, sem jargão. Vale a mesma régua de tom das restrições.",
          "Nos grupos de profissionais de beleza: participe e ajude. Divulgação direta em grupo queima reputação.",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Sem depoimento até existir cliente.** Enquanto isso, o conteúdo de prova é a **demonstração aberta**: gravar a tela do salão de demonstração é honesto, mostra o produto real e não depende de ninguém.",
      },
    ],
  },

  {
    id: "parcerias",
    rotulo: "Parcerias",
    titulo: "Parcerias B2B2C — o canal mais subestimado",
    subtitulo: "Um contato certo fala com dezenas de salões. Custo zero, retorno alto.",
    blocos: [
      {
        tipo: "lista",
        titulo: "Quem procurar:",
        itens: [
          "**Distribuidoras de produtos de beleza:** o representante visita dezenas de salões por semana e já tem a confiança da dona.",
          "**Cursos de estética, barbearia e cabeleireiro:** turmas inteiras de futuros autônomos, que são o alvo secundário.",
          "**Contadores que atendem salões:** falam com o dono sobre dinheiro, que é onde o produto ajuda.",
          "**Lojas de móveis e equipamentos para salão:** o salão novo é o melhor momento para adotar um sistema.",
        ],
      },
      {
        tipo: "texto",
        md: "**A oferta para o parceiro** precisa valer o esforço dele: comissão por salão que vira pagante, ou desconto para a base dele, ou simplesmente ser o cara que trouxe algo útil. Comece pelo mais simples — apresentação mútua — e só formalize comissão quando houver receita para dividir.",
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "Não prometa comissão recorrente antes de ter cliente pagante e um jeito de apurar. Promessa de comissão que você não consegue pagar destrói a parceria e a reputação junto.",
      },
    ],
  },

  {
    id: "seo",
    rotulo: "SEO e blog",
    titulo: "Busca — o canal que trabalha enquanto você dorme",
    subtitulo: "Demora meses, custa zero, e a estrutura já está pronta no produto.",
    blocos: [
      {
        tipo: "texto",
        md: "O produto já tem blog, mapa do site, dados estruturados de negócio local em cada página de salão e títulos otimizados. A estrutura existe; falta conteúdo com constância.",
      },
      {
        tipo: "lista",
        titulo: "Dois tipos de busca a atacar, com intenções bem diferentes:",
        itens: [
          "**Quem procura sistema** (\"sistema de agendamento para salão\", \"app para barbearia\", \"controle de comissão salão\"). Intenção comercial, volume menor, converte.",
          "**Quem tem o problema mas não sabe o nome da solução** (\"como organizar a agenda do salão\", \"como calcular comissão de cabeleireiro\", \"como cobrar taxa de deslocamento em atendimento a domicílio\"). Volume maior, converte mais devagar, constrói autoridade.",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Uma peça de conteúdo boa resolve o problema mesmo sem o produto.** Um artigo que ensina a calcular comissão na mão, e no fim mostra que o sistema faz sozinho, ganha confiança. Artigo que só empurra o produto não ranqueia e não converte.",
      },
    ],
  },

  {
    id: "influencia",
    rotulo: "Influência",
    titulo: "Influência — micro, local e do ramo",
    subtitulo: "Não é sobre alcance. É sobre a palavra de quem o público já ouve.",
    blocos: [
      {
        tipo: "texto",
        md: "O influenciador certo aqui **não é o de beleza com um milhão de seguidores**. É a cabeleireira da cidade com 4 mil seguidores que outras profissionais acompanham, o professor de curso de barbearia, a lash designer que dá dica de negócio. Alcance pequeno, confiança alta, custo baixo.",
      },
      {
        tipo: "lista",
        titulo: "Como abordar:",
        itens: [
          "Ofereça o produto montado e o acompanhamento — a mesma coisa que você faz em campo. Quem usa de verdade fala melhor.",
          "Nunca peça \"post elogiando\". Peça que use e conte a experiência real, boa ou ruim.",
          "**Publicidade tem que estar declarada.** Se houver qualquer contrapartida, a peça precisa dizer. É exigência legal e o público de bairro percebe quando não está.",
          "Combine entrega concreta: o que será publicado, quando, e por quanto tempo fica no ar.",
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Não pague por permuta antes de o produto ter rodagem.** Um influenciador que usa e encontra um problema não resolvido fala sobre isso — e o alcance que você comprou trabalha contra você.",
      },
    ],
  },

  {
    id: "pago",
    rotulo: "Tráfego pago",
    titulo: "Tráfego pago — preparado, não ligado",
    subtitulo: "Suspenso por decisão, não por falta de plano. Isto aqui é o plano, pronto para o dia em que destravar.",
    blocos: [
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Não está ativo.** Um agente que receber \"crie uma campanha\" deve entregar o plano e dizer explicitamente que o gatilho de ativação ainda não foi atingido. Sem cliente pagante, mídia paga leva tráfego a uma oferta que ainda não provou converter — e o dinheiro some antes do aprendizado.",
      },
      {
        tipo: "lista",
        titulo: "Quando ligar, ligue nesta ordem:",
        itens: [
          "**Busca, com intenção comercial e raio local.** Quem digita \"sistema de agendamento para salão\" já sabe o que quer. Volume baixo, custo por clique baixo neste nicho, e é o teste mais barato de mensagem.",
          "**Remarketing para quem entrou na demonstração e não criou conta.** É o público mais quente que existe, e o mais barato de reconquistar.",
          "**Interesse em rede social, com raio de bairro/cidade.** Só depois que a peça de busca ensinar qual mensagem converte.",
        ],
      },
      {
        tipo: "lista",
        titulo: "Regras para qualquer campanha paga:",
        itens: [
          "**Um objetivo por campanha**, e o objetivo é conta criada com salão montado — não clique, não visita.",
          "**Verba de teste com teto definido antes de subir**, e critério escrito de quando desligar.",
          "**Destino é a demonstração ou a página do produto**, nunca a página de um salão cliente.",
          "**Raio geográfico apertado.** O diferencial é presença local; anúncio nacional vende uma promessa que você não consegue cumprir.",
          "Nada de promessa de resultado no criativo — vale integralmente a lista de restrições.",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**A conta que decide se vale:** com ticket de R$ 55–70/mês e churn de 7%, um cliente vale poucas centenas de reais ao longo da vida. Isso define um teto baixo de custo de aquisição — e é por isso que porta a porta, que custa tempo e não dinheiro, ganha desta fase.",
      },
    ],
  },
];
