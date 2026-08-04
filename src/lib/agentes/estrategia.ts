import type { Secao } from "./tipos";

/**
 * Estratégia de mercado — o conteúdo que o Playbook (/admin) exibe e que o
 * pacote dos agentes exporta. Fonte única: editar aqui muda os dois.
 *
 * Escrito para a fase atual (meio período, sem verba de mídia, meta de renda
 * complementar). Quando a fase mudar, isto muda junto — e o agente muda com ele.
 */
export const ESTRATEGIA: Secao[] = [
  {
    id: "norte",
    rotulo: "O Norte",
    titulo: "O Norte — a estratégia em uma tela",
    subtitulo: "Leia isto sempre que sentir que se perdeu. O resto detalha cada ponto.",
    blocos: [
      {
        tipo: "texto",
        md: "**A ideia central:** no começo você não vence por marketing — vence por **presença**. Grandes concorrentes não batem na porta do salão do bairro. Você bate. Seu diferencial imbatível nesta fase é ser **local, presente e humano**: você aparece, monta o sistema junto com a dona e volta pra ajudar. Isso nenhum anúncio compra.",
      },
      {
        tipo: "texto",
        md: "Com meio período (~10–20h/semana) e meta de renda complementar (~10–20 salões pagando), o caminho é: **porta a porta bem feito** como motor principal + **prova social** (depoimentos dos primeiros clientes) + **indicação**. Redes sociais entram como apoio e credibilidade, não como fonte principal de venda no início.",
      },
      {
        tipo: "cartoes",
        titulo: "Os três motores, e o peso de cada um",
        itens: [
          {
            titulo: "Porta a porta",
            selo: "Motor 1 · 70%",
            linhas: [{ md: "Visitar, demonstrar ao vivo, montar o salão na hora e acompanhar o teste." }],
          },
          {
            titulo: "Prova social + indicação",
            selo: "Motor 2 · 20%",
            linhas: [{ md: "Depoimento do 1º cliente feliz vira sua melhor propaganda. Peça indicação sempre." }],
          },
          {
            titulo: "Conteúdo (redes)",
            selo: "Motor 3 · 10%",
            linhas: [{ md: "Instagram/WhatsApp mostrando o produto. Serve de vitrine e credibilidade." }],
          },
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "**A ordem que evita se perder:** (1) prepare o material e um salão-demo pronto → (2) escolha 1 bairro denso → (3) faça as primeiras visitas e ajuste o discurso → (4) feche os primeiros trials e *acompanhe de perto* até virarem pagantes → (5) colha depoimento e peça indicação → (6) repita e só então pense em ampliar.",
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Regra de ouro:** conseguir um trial é fácil; fazer o trial virar pagante é o jogo todo. A maioria não cancela por preço — cancela por **não ter usado**. Seu trabalho não acaba no cadastro; começa nele.",
      },
    ],
  },

  {
    id: "publico",
    rotulo: "Público",
    titulo: "Quem procurar primeiro (e quem deixar pra depois)",
    subtitulo: "Com tempo limitado, priorizar quem tem dor + poder de decisão + ticket viável é metade da venda.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "Salões e barbearias de 1 a 4 profissionais",
            selo: "Alvo primário",
            linhas: [
              { md: "Com movimento, dona(o) que atende e cuida da agenda no WhatsApp." },
              {
                rotulo: "Por quê",
                md: "Sente a dor todo dia (bagunça de horário, mensagem na madrugada, confusão de comissão) e decide sozinho, sem burocracia. Ticket cabe no bolso.",
              },
            ],
          },
          {
            titulo: "Autônomos que alugam cadeira e clínicas pequenas",
            selo: "Alvo secundário",
            linhas: [
              { md: "Manicure, cabeleireiro, esteticista, lash designer; clínicas de estética pequenas." },
              {
                rotulo: "Por quê",
                md: "Precisam de agenda e ficha de cliente. Convertem bem, mas ticket e urgência menores. Bom volume, boa indicação.",
              },
            ],
          },
          {
            titulo: "Redes, franquias e quem já tem sistema consolidado",
            selo: "Evite no início",
            linhas: [
              { md: "Inclui o dono que 'nunca está'." },
              {
                rotulo: "Por quê",
                md: "Venda longa, muitos decisores, exige integração. Consome seu tempo escasso. Volte quando tiver estrutura e cases.",
              },
            ],
          },
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Sinais de bom alvo (bata aqui primeiro):** agenda escrita em caderno ou só no WhatsApp; fila de espera na cadeira; dona reclamando de \"furos\" e faltas; equipe de 2–4 pessoas; salão organizado e cheio (quem já cuida do negócio valoriza organização). **Sinais de alvo ruim:** movimento fraco, dono ausente, \"já tenho sistema e adoro\".",
      },
    ],
  },

  {
    id: "posicao",
    rotulo: "Posicionamento",
    titulo: "Posicionamento — a frase que gruda",
    subtitulo: "Você não vende 'software'. Vende agenda organizada, tempo livre e dinheiro que não escapa.",
    blocos: [
      {
        tipo: "fala",
        rotulo: "Frase de posicionamento",
        md: "O sistema de agenda feito pro salão brasileiro de verdade: simples como o WhatsApp, organizado como uma recepção profissional — e com alguém de carne e osso pra te ajudar a começar.",
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Venda a transformação, não a função.** Ninguém acorda querendo \"software de agendamento\". Querem: parar de responder WhatsApp de madrugada, parar de perder horário, saber quanto cada profissional rendeu sem brigar, e passar imagem de salão profissional. Fale sempre do *resultado*, mostre a função como prova.",
      },
      {
        tipo: "cartoes",
        titulo: "Como se posicionar contra cada alternativa",
        itens: [
          {
            titulo: "Caderno / agenda de papel",
            linhas: [
              { rotulo: "Fraqueza deles", md: "Perde dado, não confirma, não avisa falta, some se molhar." },
              { rotulo: "Sua fala", md: "\"Tudo que você anota, só que não se perde e ainda confirma sozinho.\"" },
            ],
          },
          {
            titulo: "Só WhatsApp",
            linhas: [
              { rotulo: "Fraqueza deles", md: "Bagunça, mensagem de madrugada, esquece de responder e perde cliente." },
              { rotulo: "Sua fala", md: "\"A cliente agenda sozinha pelo link, você só aparece pra atender.\"" },
            ],
          },
          {
            titulo: "Sistemas grandes e caros",
            linhas: [
              { rotulo: "Fraqueza deles", md: "Caros, complexos, suporte robô, feitos pra rede grande." },
              { rotulo: "Sua fala", md: "\"Simples como o WhatsApp, preço de salão de bairro, e eu monto com você.\"" },
            ],
          },
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "**Seu trunfo único:** \"Eu sou daqui, eu apareço, eu monto pra você e volto pra ajudar.\" Nenhum concorrente grande faz isso. Repita isso — é o que fecha.",
      },
    ],
  },

  {
    id: "oferta",
    rotulo: "Oferta e preço",
    titulo: "Oferta e preço — como apresentar sem parecer caro",
    subtitulo: "O preço já é acessível. O trabalho é ancorar contra o que ela perde, não contra 'mais uma mensalidade'.",
    blocos: [
      {
        tipo: "nota",
        tom: "ganho",
        md: "**14 dias grátis, sem cartão** — esse é o seu maior ativo de venda. \"Você testa 2 semanas sem pagar nada e sem cadastrar cartão. Se não te ajudar, é só parar.\" Remove todo o risco da decisão.",
      },
      {
        tipo: "lista",
        titulo: "Ancoragem — as 3 contas que você faz na frente dela:",
        itens: [
          "**Contra o prejuízo:** \"Quantos horários você perde por mês porque não respondeu o WhatsApp a tempo? Um só já paga o mês inteiro do sistema.\"",
          "**Por dia:** \"R$ 69,90 dá menos de R$ 2,40 por dia — menos que um café. Por menos que um café você tem agenda, caixa e comissão no automático.\"",
          "**Contra o concorrente:** \"Sistema grande cobra R$ 150, R$ 200 e não te dá suporte de gente. Aqui é R$ 69,90 e sou eu que te atendo.\"",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Oferta de lançamento (opcional, poderosa):** \"Estou fechando os primeiros salões do bairro — pros primeiros, seguro o valor de lançamento pra sempre\" ou \"primeiro mês com desconto\". Cria urgência e exclusividade sem queimar preço a longo prazo. Não invente escassez falsa — combine algo que você realmente honre.",
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Não lidere pelo preço.** Só fale de valor *depois* de mostrar a dor e a solução funcionando. Preço cedo demais = objeção cedo demais.",
      },
    ],
  },

  {
    id: "gatilhos",
    rotulo: "Gatilhos",
    titulo: "Gatilhos mentais — com a fala pronta",
    subtitulo: "Gatilho sem exemplo de fala é teoria. Aqui vai o quê e o como dizer.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "Prova social",
            linhas: [
              { md: "As pessoas fazem o que veem os pares fazendo." },
              { rotulo: "Como usar", md: "\"O salão da [rua/nome] aqui perto já está usando e adorou.\" Mostre nomes reais assim que tiver. Um print de depoimento vale mil argumentos." },
            ],
          },
          {
            titulo: "Demonstração / autoridade",
            linhas: [
              { md: "Ver funcionando ao vivo derrete a desconfiança." },
              { rotulo: "Como usar", md: "Não descreva — mostre. Faça um agendamento na frente dela pelo celular. \"Olha, sua cliente faria assim, ó.\"" },
            ],
          },
          {
            titulo: "Aversão à perda",
            linhas: [
              { md: "Perder dói mais que ganhar agrada." },
              { rotulo: "Como usar", md: "\"Cada horário furado é dinheiro que não volta. Cada cliente que desiste porque você demorou a responder, foi pro concorrente.\"" },
            ],
          },
          {
            titulo: "Reciprocidade",
            linhas: [
              { md: "Quem recebe algo sente que deve retribuir." },
              { rotulo: "Como usar", md: "Monte o salão dela no sistema ali, de graça, na hora — serviços, preços, horários. Ela já sai com valor recebido e inclinada a continuar." },
            ],
          },
          {
            titulo: "Escassez / exclusividade",
            linhas: [
              { md: "O que é limitado vale mais." },
              { rotulo: "Como usar", md: "\"Estou pegando só alguns salões do bairro agora pra dar atenção de verdade a cada um.\" Verdadeiro, porque seu tempo é limitado mesmo." },
            ],
          },
          {
            titulo: "Compromisso e coerência",
            linhas: [
              { md: "Quem diz 'sim' pequeno tende ao 'sim' grande." },
              { rotulo: "Como usar", md: "Faça micro-perguntas de 'sim': \"Faz sentido pra você organizar a agenda, né?\" → \"Ia ser bom parar de perder horário?\" → aí ofereça o teste." },
            ],
          },
          {
            titulo: "Facilidade (redução de atrito)",
            linhas: [
              { md: "O esforço percebido mata a venda." },
              { rotulo: "Como usar", md: "\"Você não precisa fazer nada — eu cadastro tudo com você agora e te mostro em 5 minutos. E é sem cartão.\"" },
            ],
          },
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "Use gatilho como **verdade bem contada**, nunca como manipulação. Salão é relacionamento e boca a boca — uma promessa quebrada volta como fama ruim no bairro inteiro.",
      },
    ],
  },

  {
    id: "objecoes",
    rotulo: "Objeções",
    titulo: "Objeções — e a resposta pronta",
    subtitulo: "Objeção não é 'não'. Quase sempre é medo ou dúvida. Concorde, reduza o risco, reconduza ao teste grátis.",
    blocos: [
      {
        tipo: "nota",
        tom: "info",
        md: "**Fórmula pra qualquer objeção:** 1) Concorde (\"Entendo, faz sentido\") → 2) Reenquadre (mostre o outro lado) → 3) Reduza o risco (teste grátis, sem cartão, eu monto) → 4) Micro-compromisso (\"bora deixar rodando esses dias?\").",
      },
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "\"Já uso o WhatsApp / caderno e funciona.\"",
            linhas: [{ rotulo: "Resposta", md: "\"Funciona até o dia que dá errado — some uma folha, você esquece de responder, marca dois no mesmo horário. O sistema faz tudo isso não acontecer, e continua tão fácil quanto o WhatsApp. Testa 14 dias de graça e me diz se voltaria pro caderno.\"" }],
          },
          {
            titulo: "\"Minhas clientes são mais velhas, não vão saber usar.\"",
            linhas: [{ rotulo: "Resposta", md: "\"Elas não precisam baixar nada — só clicam num link, igual abrir uma mensagem. E quem prefere, você mesma agenda por dentro em segundos. Ninguém fica de fora.\"" }],
          },
          {
            titulo: "\"Já tentei um sistema e era complicado, larguei.\"",
            linhas: [{ rotulo: "Resposta", md: "\"Foi por isso que fiz esse simples e vim aqui pessoalmente. A diferença é que eu monto com você e fico de olho na primeira semana. Você não vai ficar sozinha pra descobrir sozinha.\"" }],
          },
          {
            titulo: "\"Tá caro / não tenho como pagar mais uma mensalidade.\"",
            linhas: [{ rotulo: "Resposta", md: "\"Dá menos de R$ 2,40 por dia. Um horário que você deixa de perder no mês já paga o sistema. Não é gasto, é o que impede o dinheiro de escapar. E os primeiros 14 dias são de graça pra você ver isso acontecer.\"" }],
          },
          {
            titulo: "\"Não tenho tempo de cadastrar tudo.\"",
            linhas: [{ rotulo: "Resposta", md: "\"Você não vai cadastrar — eu faço agora com você, em uns 10 minutos, seus serviços e horários. Sai daqui já funcionando.\"" }],
          },
          {
            titulo: "\"E se eu parar de pagar, perco tudo?\"",
            linhas: [{ rotulo: "Resposta", md: "\"Seus dados são seus. E como é sem cartão no teste, você nunca paga sem querer. Só continua se fizer sentido pra você.\"" }],
          },
          {
            titulo: "\"Vou pensar / depois eu vejo.\"",
            selo: "a mais comum",
            linhas: [{ rotulo: "Resposta", md: "\"Claro, sem pressa pra decidir pagar. Mas o teste é grátis e leva 10 minutos pra montar — que tal deixarmos rodando esses dias e você decide com o sistema já funcionando, não no escuro? Se não gostar, é só parar.\"" }],
          },
          {
            titulo: "\"Minha recepcionista já cuida disso.\"",
            linhas: [{ rotulo: "Resposta", md: "\"Ótimo — o sistema é a melhor ferramenta dela. Ela para de anotar em papel, vê a agenda do dia inteira e fecha comissão sem calculadora. Facilita a vida dela, não substitui.\"" }],
          },
        ],
      },
    ],
  },

  {
    id: "campo",
    rotulo: "Porta a porta",
    titulo: "Porta a porta — o passo a passo",
    subtitulo: "Seu motor principal. Preparação + roteiro + follow-up. Decore o fluxo, improvise as palavras.",
    blocos: [
      {
        tipo: "lista",
        titulo: "Antes de sair (uma vez só, na semana 1):",
        itens: [
          "Um **salão-demo pronto** no celular (serviços, agenda com horários, um fechamento de comissão) pra mostrar funcionando.",
          "Cartão simples com seu nome, WhatsApp e o link.",
          "Escolha **1 bairro denso** de salões. Trabalhe rua por rua — não pule por toda a cidade.",
          "Roteiro decorado e a oferta de lançamento definida.",
          "Boa aparência e uma pasta/celular carregado. Você é a cara do produto.",
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Horário certo muda tudo.** Vá nos horários *mortos* do salão — meio da manhã e meio da tarde, começo de semana (seg–qua). Nunca no pico (fim de tarde, sábado). Dona ocupada com cliente não ouve ninguém.",
      },
      {
        tipo: "fala",
        rotulo: "1. Abertura (30 segundos, sem vender)",
        md: "Oi, tudo bem? Sou o [nome], sou daqui da região. Criei um sistema de agenda pra salões e barbearias e tô passando nos daqui pra mostrar. Você tem 2 minutinhos numa hora que não esteja com cliente?",
      },
      {
        tipo: "fala",
        rotulo: "2. Descoberta (deixe ela falar a dor)",
        md: "Como você marca os horários hoje? … Já aconteceu de perder horário ou marcar dois na mesma hora? … E pra saber quanto cada profissional rendeu no mês, como você faz? — anote a dor que mais incomodar, é nela que você aperta.",
      },
      {
        tipo: "fala",
        rotulo: "3. Demonstração (2–3 min, no celular, ao vivo)",
        md: "Olha como fica: sua cliente abre esse link, escolhe o serviço, o profissional e o horário livre — e você recebe já confirmado, sem precisar responder. E aqui, ó, o fechamento do dia com a comissão de cada um, calculada sozinha. — Mostre só as 1–2 dores dela, não o sistema inteiro.",
      },
      {
        tipo: "fala",
        rotulo: "4. Oferta + fechamento (reduza o atrito a zero)",
        md: "Tem 14 dias grátis, sem cartão. E o melhor: eu monto seu salão aqui agora com você, uns 10 minutos, e você já sai usando. Bora fazer?",
      },
      {
        tipo: "fala",
        rotulo: "5. Se não fechar agora (nunca saia de mãos vazias)",
        md: "Sem problema! Deixa eu te passar meu contato e pegar o seu — te mando o link e, se quiser, montamos essa semana. Posso passar aqui de novo na [dia]? — Sempre capture o WhatsApp.",
      },
      {
        tipo: "lista",
        titulo: "Follow-up (é aqui que a venda acontece de verdade):",
        itens: [
          "**No mesmo dia:** mensagem curta agradecendo + link. \"Foi ótimo te conhecer! Aqui o link. Qualquer coisa é só chamar.\"",
          "**Quem iniciou o teste — acompanhe:** D+1 (\"conseguiu criar seu primeiro agendamento?\"), D+3 (\"te ajudo a colocar seus serviços?\"), D+7 (\"como tá indo?\"), D+12 (\"seu teste acaba em 2 dias, bora continuar?\").",
          "**Quem não fechou:** uma passada de volta em ~1 semana costuma converter quem \"ia pensar\".",
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "Meta realista de meio período: **3 a 4 saídas de campo por semana**, ~5–7 conversas reais por saída. Não é sobre bater em 100 portas por dia — é bater nas certas e **acompanhar quem demonstrou interesse**.",
      },
    ],
  },

  {
    id: "redes",
    rotulo: "Redes e canais",
    titulo: "Redes sociais e canais de custo zero",
    subtitulo: "Apoio, não motor. Servem de vitrine e prova de que você existe e é sério — enquanto o porta a porta traz os clientes.",
    blocos: [
      {
        tipo: "lista",
        titulo: "Instagram / TikTok (o mínimo que dá resultado):",
        itens: [
          "Perfil profissional com bio clara (\"Sistema de agenda pra salões e barbearias · teste grátis\") e o link.",
          "**Reels curtos de dor:** \"3 confusões que o caderninho causa no salão\", \"como sua cliente pode agendar sozinha em 20 segundos\".",
          "**Antes/depois:** a bagunça do WhatsApp × a agenda organizada.",
          "**Bastidor:** você montando o salão de um cliente, depoimento em vídeo (ouro puro).",
          "Cadência sustentável: 2–3 posts/semana é melhor que 1 post/dia por uma semana e sumir.",
        ],
      },
      {
        tipo: "lista",
        titulo: "Canais gratuitos de alto retorno:",
        itens: [
          "**WhatsApp:** status mostrando o produto; grupos de profissionais de beleza da cidade (participe, ajude, não faça spam).",
          "**Google Meu Negócio:** perfil grátis pra aparecer quando buscarem \"sistema de agenda salão [cidade]\".",
          "**Indicação:** \"Indicou e o salão assinou? Você ganha 1 mês / desconto.\" Boca a boca de salão é forte.",
          "**Parcerias B2B2C:** distribuidoras de produtos de beleza, cursos de estética/barbearia — eles falam com dezenas de salões e podem te apresentar.",
        ],
      },
      {
        tipo: "nota",
        tom: "info",
        md: "**Regra de conteúdo:** cada post responde \"o que a dona ganha?\", nunca \"que legal meu sistema\". Mostre a dor dela e o alívio. Um depoimento real vale mais que dez posts bonitos.",
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "Não caia na armadilha de passar o tempo todo produzindo conteúdo e fugindo do porta a porta (é mais confortável, mas vende menos no início). Conteúdo é **10% do esforço** nesta fase.",
      },
    ],
  },

  {
    id: "metricas",
    rotulo: "Métricas",
    titulo: "O funil e o que medir",
    subtitulo: "O que não se mede não melhora. Anote toda semana — o painel já mostra trials, conversão e churn.",
    blocos: [
      {
        tipo: "tabela",
        colunas: ["Etapa do funil", "Meta", "O que é"],
        linhas: [
          ["Abordagens reais", "~20/semana", "Conversas em que a dona ouviu o pitch."],
          ["Demonstrações", "~50% das abordagens", "Conseguiu mostrar funcionando."],
          ["Trials iniciados", "~25% das abordagens", "Criou conta e você montou o salão."],
          ["Trials ativos", "≥70% dos trials", "Usaram de verdade (agendaram algo). Métrica que prevê conversão."],
          ["Convertidos em pagante", "~30% dos trials", "O número que importa."],
          ["Churn mensal", "< 8%", "Quantos pagantes cancelam por mês. Baixe cuidando da adoção."],
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "**A métrica que mais prevê sucesso:** \"trials ativos\" (usaram de verdade). Um trial que nunca criou um agendamento quase nunca vira pagante. Foque energia em fazer o trial *usar* na primeira semana — não em abrir mais trials mortos.",
      },
      {
        tipo: "nota",
        tom: "info",
        md: "Revise seus números **toda sexta**. Ex.: muitas demos e poucos trials = seu fechamento precisa de mais \"eu monto agora\"; muitos trials e poucos pagantes = falta acompanhamento na semana do teste.",
      },
    ],
  },

  {
    id: "projecao",
    rotulo: "Projeção",
    titulo: "Projeção de crescimento — 2 cenários",
    subtitulo: "Estimativas, não promessas. Servem de meta e de régua. Recalibre com seus números reais do painel.",
    blocos: [
      {
        tipo: "texto",
        md: "**Premissas** (meio período, ~80 abordagens/mês). **Realista:** 25% iniciam trial · 30% viram pagante · churn 7%/mês · ticket médio R$ 55. **Otimista:** 38% iniciam trial · 42% viram pagante · churn 4%/mês · ticket R$ 60 + indicações a partir do mês 3. Os 2 primeiros meses crescem menos: é a curva de aprendizado do discurso.",
      },
      {
        tipo: "tabela",
        titulo: "Cenário realista",
        colunas: ["Período", "Pagantes", "MRR"],
        linhas: [
          ["Mês 1", "2", "R$ 110"],
          ["Mês 2", "5", "R$ 275"],
          ["Mês 3", "8", "R$ 440"],
          ["Mês 4", "11", "R$ 605"],
          ["Mês 5", "14", "R$ 770"],
          ["Mês 6", "16", "R$ 880"],
        ],
      },
      {
        tipo: "tabela",
        titulo: "Cenário otimista",
        colunas: ["Período", "Pagantes", "MRR"],
        linhas: [
          ["Mês 1", "4", "R$ 240"],
          ["Mês 2", "9", "R$ 540"],
          ["Mês 3", "15", "R$ 900"],
          ["Mês 4", "21", "R$ 1.260"],
          ["Mês 5", "28", "R$ 1.680"],
          ["Mês 6", "35", "R$ 2.100"],
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "Sua meta de **renda complementar (10–20 pagantes)** cai no **mês 4–6 no realista** e já no **mês 3 no otimista**. Factível com meio período — desde que o follow-up seja levado a sério.",
      },
      {
        tipo: "texto",
        md: "**Régua \"por unidade\":** a cada **100 salões abordados** → realista ~25 trials → **~7–8 pagantes**; otimista ~38 trials → **~16 pagantes**. Multiplique pelo número de salões alcançáveis no seu bairro/cidade.",
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Quando começar a pagar infra:** quando tiver **3–5 pagantes** (o MRR já cobre com folga). Antes disso, mantenha custo zero. Reinvista em anúncios locais só depois de o porta a porta estar previsível.",
      },
    ],
  },

  {
    id: "roteiro",
    rotulo: "Roteiro",
    titulo: "Roteiro de execução — a ordem certa",
    subtitulo: "Siga as fases na ordem; não pule a preparação nem o follow-up.",
    blocos: [
      {
        tipo: "fases",
        itens: [
          {
            fase: "Fase 0 — Semana 1",
            titulo: "Preparação (não pule)",
            itens: [
              "Montar o salão-demo no celular (serviços, agenda, comissão).",
              "Fazer cartão simples com nome, WhatsApp e link.",
              "Escolher 1 bairro denso e mapear as ruas com salões.",
              "Decorar o roteiro de visita e definir a oferta de lançamento.",
              "Criar perfil no Instagram e no Google Meu Negócio.",
            ],
          },
          {
            fase: "Fase 1 — Semanas 2 a 4",
            titulo: "Primeiras visitas e ajuste do discurso",
            itens: [
              "3–4 saídas de campo por semana, rua por rua.",
              "Meta: primeiras conversas, demos e os primeiros trials montados na hora.",
              "Anotar toda objeção que aparecer e afinar as respostas.",
              "Acompanhar de perto cada trial (D+1, D+3, D+7, D+12).",
              "Objetivo do mês: 2–4 primeiros pagantes + aprender o que converte.",
            ],
          },
          {
            fase: "Fase 2 — Mês 2",
            titulo: "Prova social e indicação",
            itens: [
              "Gravar depoimento em vídeo do 1º cliente feliz.",
              "Dobrar a aposta no tipo de salão que mais converteu.",
              "Ativar o programa de indicação com cada cliente satisfeito.",
              "Começar a postar 2–3x/semana (dor + depoimento).",
              "Revisar o funil toda sexta e corrigir o ponto que mais vaza.",
            ],
          },
          {
            fase: "Fase 3 — Mês 3 em diante",
            titulo: "Sistematizar e ampliar",
            itens: [
              "Pedir indicação de forma sistemática (vira 30–40% dos novos).",
              "Expandir pro bairro vizinho quando o primeiro estiver coberto.",
              "Com 3–5 pagantes: migrar a infra paga (Vercel Pro, domínio próprio).",
              "Buscar 1–2 parcerias (distribuidora, curso de beleza).",
              "Só então testar um pequeno anúncio local, se o caixa permitir.",
            ],
          },
        ],
      },
      {
        tipo: "nota",
        tom: "ganho",
        md: "**Se você fizer só uma coisa certa:** montar o salão na hora, de graça, e acompanhar o trial na primeira semana. É o que transforma \"achei legal\" em cliente que paga e fica.",
      },
    ],
  },
];
