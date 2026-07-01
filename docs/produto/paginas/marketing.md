# Marketing (Divulgação)

Rota: `/painel/[slug]/marketing`
Arquivo principal: `src/app/painel/[slug]/marketing/page.tsx`, `src/app/painel/[slug]/marketing/MarketingManager.tsx`, API `src/app/api/marketing/generate/route.ts`

## Objetivo

Assistente em 4 passos para gerar artes prontas (imagem + legenda) para status do WhatsApp, Instagram e Facebook, a partir de um serviço, uma promoção ativa ou uma foto de trabalho realizado.

## Funcionalidades

- Passo 1 — escolha do tipo de arte: Promoção (campanha ativa), Serviço (do catálogo) ou Trabalho pronto (upload de foto da cliente).
- Passo 2 — detalhes: seleção da campanha/serviço específico, upload opcional de foto (no fluxo de "Trabalho pronto"), campo de observação livre (até 120 caracteres).
- Passo 3 — formato (Stories/WhatsApp vertical, Feed do Instagram quadrado, Capa do Facebook horizontal) e estilo visual (elegante, vibrante, clean, festivo).
- Passo 4 — resultado: preview da arte com camada de texto editável por cima (título, destaque de preço/desconto, chamada, posição e tema claro/escuro), legenda pronta e editável, botões de baixar (compõe PNG via canvas), compartilhar (Web Share API) e "gerar outra".
- Badge de créditos no cabeçalho mostrando saldo mensal e adicional; botão "Comprar +10" hoje é só um `alert()` ("chega em breve"), não implementado.

## Permissões

Sem restrição além de acesso ao painel (`getMembershipBySlug`) — qualquer membro do salão com acesso à rota consegue usar a página. Não há checagem de `perms.has(...)` específica nesta página nem na API de geração.

## Inteligência (IA)

**Geração de imagem/legenda por IA está implementada apenas como stub — não gera conteúdo real hoje.**

- A API `/api/marketing/generate` monta prompts estruturados (`buildImagePrompt`, `buildCaptionPrompt` em `src/lib/marketing/prompts.ts`), mas:
  - Se `OPENAI_API_KEY` **não** está configurada (caso atual): devolve um SVG placeholder gerado localmente (gradiente com as cores do salão + texto "Prévia da arte / IA será conectada em breve") e uma legenda estática por template (`stubCaption`), sem custo e sem consumir créditos.
  - Se `OPENAI_API_KEY` **está** configurada: a chamada real à OpenAI (gpt-image-1 para imagem, chat completions para legenda) está comentada no código (`// TODO(openai): trocar pelo gpt-image-1...`); o endpoint apenas consome 1 crédito e responde erro 501 ("Geração ao vivo ainda não habilitada — faltam ajustes finais").
- A UI já exibe um banner explícito de "Modo prévia" quando `credits.preview` é verdadeiro, avisando que a geração por IA ainda não está conectada.
- Créditos (`src/lib/marketing/credits.ts`): cota mensal padrão de 20 imagens/mês (tabela `ai_credits`), saldo de add-on que não expira. Enquanto a tabela `ai_credits` não existe no banco, o sistema cai automaticamente em modo prévia (ilimitado, sem cobrar crédito).

## Dados / Backend

- Tabelas: `services`, `campaigns`, `ai_credits` (opcional/pode não existir ainda — fallback gracioso).
- Sem RPCs específicas; toda a lógica de geração roda na API route `/api/marketing/generate`.

## Observações

- Rota `/marketing` hoje está liberada para todos os planos por decisão deliberada de desenvolvimento (`MAX_ONLY_HREFS` está vazio em `src/lib/plans.ts`, com um TODO explícito para mover `/marketing` para lá quando a IA estiver ligada de verdade).
- Consistente com `docs/produto/zulan-2.0-roadmap-ia.md`: essa página não é mencionada ali como narrador de IA — o roadmap trata de outro tipo de IA (narrador de insights via DeepSeek em Dashboard/Agenda/Clientes/etc.), não da geração de imagens da página Marketing.
