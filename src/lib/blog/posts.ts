// Conteúdo do blog — sem CMS. Cada post é estruturado em seções simples
// (título + parágrafos + bullets) para renderizar com tipografia consistente
// e gerar metadados/JSON-LD de SEO. Para publicar um novo artigo, adicione
// um objeto a POSTS.

export type PostSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO (YYYY-MM-DD)
  readMinutes: number;
  sections: PostSection[];
};

export const POSTS: Post[] = [
  {
    slug: "como-reduzir-faltas-no-salao",
    title: "Como reduzir faltas (no-show) no salão ou barbearia",
    excerpt:
      "Cadeira vazia é dinheiro perdido. Veja práticas simples para diminuir faltas e recuperar quem não apareceu.",
    category: "Gestão",
    date: "2026-06-24",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "A falta de cliente (o famoso no-show) é um dos maiores ralos de faturamento de salões e barbearias. Cada horário reservado e não cumprido é um espaço que poderia ter sido de outra pessoa — e que não volta. A boa notícia é que dá para reduzir muito as faltas com pequenas mudanças no processo.",
        ],
      },
      {
        heading: "1. Confirme o horário com antecedência",
        paragraphs: [
          "A maioria das faltas não é má-fé: é esquecimento. Um lembrete um dia antes e algumas horas antes do atendimento já corta boa parte dos no-shows. Quando o agendamento é online, a própria cliente recebe a confirmação na hora em que marca, o que reduz a chance de confusão de data e horário.",
        ],
      },
      {
        heading: "2. Facilite o reagendamento",
        paragraphs: [
          "Muita gente falta porque não conseguiu avisar a tempo ou achou trabalhoso remarcar. Quando a cliente consegue cancelar e reagendar sozinha pelo link, o horário é liberado automaticamente para outra pessoa — você não perde o espaço e ainda mantém o relacionamento.",
        ],
      },
      {
        heading: "3. Tenha uma política clara",
        paragraphs: [
          "Deixe combinado o que acontece em caso de falta sem aviso. Não precisa ser rígido: uma comunicação gentil já educa a clientela. Para quem falta com frequência, considere pedir confirmação obrigatória ou um sinal no próximo agendamento.",
        ],
      },
      {
        heading: "4. Recupere quem faltou",
        paragraphs: [
          "Faltou não significa cliente perdido. Uma mensagem no dia seguinte — leve, sem cobrança — convidando a remarcar costuma trazer a pessoa de volta. Vale ainda anexar um cupom de retorno para dar aquele empurrãozinho.",
        ],
        bullets: [
          "Liste quem faltou ou cancelou nos últimos dias.",
          "Mande uma mensagem pronta no WhatsApp convidando a remarcar.",
          "Ofereça um desconto de retorno quando fizer sentido.",
        ],
      },
      {
        heading: "Como o Zulan ajuda",
        paragraphs: [
          "No Zulan, a cliente agenda pelo seu link, recebe confirmação automática e pode cancelar sozinha (liberando o horário na hora). E a aba Recuperar clientes reúne quem faltou, cancelou ou está sumido, com um botão para chamar no WhatsApp com a mensagem pronta — e cupom de retorno opcional.",
        ],
      },
    ],
  },
  {
    slug: "link-de-agendamento-online-para-saloes",
    title: "Link de agendamento online: por que seu salão precisa de um",
    excerpt:
      "Sair do vai-e-volta no WhatsApp muda o jogo. Entenda como um link de agendamento profissionaliza o salão e libera o seu tempo.",
    category: "Agendamento",
    date: "2026-06-20",
    readMinutes: 4,
    sections: [
      {
        paragraphs: [
          "Atender agendamento por mensagem parece prático, mas cobra um preço alto: interrompe o atendimento, gera confusão de horários e some no meio das conversas. Um link de agendamento online resolve isso colocando a sua agenda para trabalhar sozinha.",
        ],
      },
      {
        heading: "A cliente marca quando quiser",
        paragraphs: [
          "Com um link, a pessoa vê os horários disponíveis e escolhe o que cabe na rotina dela — inclusive de madrugada ou no fim de semana, quando você não está respondendo mensagem. Você acorda com a agenda preenchida.",
        ],
      },
      {
        heading: "Menos erro, menos retrabalho",
        paragraphs: [
          "Como o horário é confirmado na hora, acaba o risco de marcar duas clientes no mesmo encaixe ou anotar errado no caderninho. Tudo fica registrado, organizado e acessível pelo celular.",
        ],
      },
      {
        heading: "Imagem mais profissional",
        paragraphs: [
          "Um link bonito, com a sua marca, passa seriedade. É o tipo de detalhe que faz a cliente confiar mais e indicar o seu trabalho. E você ainda pode divulgar esse link no Instagram, no status do WhatsApp e no Google.",
        ],
      },
      {
        heading: "Comece simples",
        paragraphs: [
          "Não precisa de site nem de conhecimento técnico. No Zulan, você cria o salão em poucos minutos, cadastra serviços e horários e já recebe um link pronto para compartilhar. A cliente agenda, recebe confirmação automática e você só aparece para atender.",
        ],
      },
    ],
  },
  {
    slug: "ideias-para-lotar-a-agenda-do-salao",
    title: "7 ideias para lotar a agenda do seu salão",
    excerpt:
      "Da divulgação ao pós-atendimento: ideias práticas para encher a agenda sem depender só do boca a boca.",
    category: "Marketing",
    date: "2026-06-16",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Agenda cheia não é sorte — é processo. Pequenas ações repetidas com constância enchem mais a agenda do que uma promoção isolada. Veja sete ideias que funcionam para salões e barbearias de qualquer tamanho.",
        ],
      },
      {
        heading: "1. Espalhe seu link de agendamento",
        paragraphs: [
          "Coloque o link na bio do Instagram, no status do WhatsApp e na ficha do Google. Quanto mais fácil for marcar, mais gente marca.",
        ],
      },
      {
        heading: "2. Reative clientes antigos",
        paragraphs: [
          "Quem já te conhece é o público mais barato de trazer de volta. Uma mensagem para quem não aparece há um tempo costuma reabrir muitos horários.",
        ],
      },
      {
        heading: "3. Crie campanhas com prazo",
        paragraphs: [
          "Descontos sem data viram preço novo. Campanhas com começo e fim criam urgência e movimentam dias mais fracos da semana.",
        ],
      },
      {
        heading: "4. Aproveite os horários ociosos",
        paragraphs: [
          "Ofereça uma condição especial para os períodos vagos (manhãs, meio de semana). Melhor a cadeira ocupada com margem menor do que parada.",
        ],
      },
      {
        heading: "5. Incentive a indicação",
        paragraphs: [
          "Cliente satisfeita traz cliente. Um benefício simples para quem indica amiga rende novos agendamentos com custo quase zero.",
        ],
      },
      {
        heading: "6. Capriche no pós-atendimento",
        paragraphs: [
          "Já saia com o próximo horário marcado e mantenha contato. A recompra é o que sustenta a agenda cheia ao longo do mês.",
        ],
      },
      {
        heading: "7. Mostre seu trabalho",
        paragraphs: [
          "Fotos de antes e depois, depoimentos e artes de divulgação atraem quem ainda não te conhece. Conteúdo constante mantém você na lembrança.",
        ],
      },
      {
        heading: "Junte tudo num lugar só",
        paragraphs: [
          "O Zulan reúne o link de agendamento, campanhas, recuperação de clientes e criação de artes de divulgação — para você executar essas ideias sem pular de ferramenta em ferramenta.",
        ],
      },
    ],
  },
];

export function getAllPosts(): Post[] {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
