import type { Secao } from "./tipos";

/**
 * Manutenção — o que um agente precisa saber antes de tocar no código.
 *
 * Não é documentação de arquitetura completa (essa envelhece e mente). São as
 * regras que, quando ignoradas, quebram o sistema de um jeito que o agente não
 * percebe: migração aplicada num lugar só, função duplicada em vez de
 * substituída, dado de um salão vazando para outro.
 */
export const MANUTENCAO: Secao[] = [
  {
    id: "stack",
    rotulo: "Base",
    titulo: "A base técnica",
    subtitulo: "O essencial para se localizar.",
    blocos: [
      {
        tipo: "lista",
        itens: [
          "**Next.js (App Router) com TypeScript e Tailwind v4.** A versão em uso tem mudanças de contrato em relação ao que a maioria dos modelos conhece — os guias oficiais ficam em `node_modules/next/dist/docs/` e devem ser lidos antes de escrever código.",
          "**Supabase (Postgres)** para banco, autenticação e arquivos. A maior parte da regra de negócio vive em **funções SQL**, não no cliente.",
          "**Isolamento por salão via RLS**, aplicado no banco. Não é filtro de tela — é política de linha.",
          "**Asaas** para a cobrança da assinatura dos salões.",
          "**Vitest** para testes. Rode `npm test` antes de considerar qualquer coisa pronta.",
        ],
      },
    ],
  },

  {
    id: "regras",
    rotulo: "Regras",
    titulo: "Regras que já custaram caro",
    subtitulo: "Cada uma destas veio de um problema real. Ignorar repete o problema.",
    blocos: [
      {
        tipo: "cartoes",
        itens: [
          {
            titulo: "Migração vai para dois lugares",
            linhas: [
              { md: "Todo `.sql` é gravado em `supabase/migrations/` **e** aplicado no projeto remoto." },
              { rotulo: "Se ignorar", md: "O repositório e o banco divergem em silêncio, e a próxima migração é escrita em cima de um estado que não existe." },
            ],
          },
          {
            titulo: "Valor de enum tem migração própria",
            linhas: [
              { md: "`alter type ... add value` não roda na mesma transação em que o valor é usado." },
              { rotulo: "Se ignorar", md: "A migração falha inteira. Separe em dois arquivos: um cria o valor, outro usa." },
            ],
          },
          {
            titulo: "Parâmetro novo com padrão cria sobrecarga",
            linhas: [
              { md: "Adicionar um parâmetro com valor padrão **não substitui** a função: cria uma segunda." },
              { rotulo: "Se ignorar", md: "A API responde \"function is not unique\" e a tela quebra. Faça `drop function` antes de recriar." },
            ],
          },
          {
            titulo: "Fronteira entre salões é sagrada",
            linhas: [
              { md: "Toda consulta e toda função nova precisa respeitar o salão. Nunca confie no filtro que veio da tela." },
              { rotulo: "Se ignorar", md: "É o pior defeito possível neste produto: o salão A vê a carteira de clientes do salão B." },
            ],
          },
          {
            titulo: "O painel é uma casca com um scroll só",
            linhas: [
              { md: "O documento fica travado na altura da janela; quem rola é o `main`. Nenhuma tela do painel deve criar um segundo container rolável." },
              { rotulo: "Se ignorar", md: "Voltam os dois scrolls empilhados e a faixa branca no rodapé do celular." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "estilo",
    rotulo: "Estilo",
    titulo: "Como o código deste projeto é escrito",
    subtitulo: "Para o código novo não destoar do que já existe.",
    blocos: [
      {
        tipo: "lista",
        itens: [
          "**Nomes e textos em português.** Inclusive variáveis e funções novas.",
          "**Comentário explica o porquê, nunca o quê.** O padrão do projeto é registrar a decisão e o problema que ela evita — quem lê depois precisa saber o que acontece se desfizer.",
          "**Mensagem de erro diz o que fazer.** \"Não foi possível\" sozinho é considerado defeito de produto, não de código.",
          "**Cores e raios saem das variáveis** de `globals.css`. Não escreva hexadecimal solto em componente.",
          "**Commit em português**, no formato `tipo(escopo): o que mudou`, com o corpo explicando o problema que existia.",
        ],
      },
      {
        tipo: "nota",
        tom: "alerta",
        md: "**Antes de dizer que terminou:** `npx tsc --noEmit`, `npm test` e o lint precisam passar. E, se a mudança for visível, ela precisa ter sido vista funcionando — não apenas compilada.",
      },
    ],
  },
];
