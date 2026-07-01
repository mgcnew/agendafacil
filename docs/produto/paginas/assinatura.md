# Assinatura

Rota: `/painel/[slug]/assinatura` (redireciona para `/painel/[slug]/configuracoes?tab=assinatura`)
Arquivo principal: `src/app/painel/[slug]/assinatura/page.tsx` (redirect), `src/app/painel/[slug]/assinatura/SubscribePanel.tsx`, `src/app/painel/[slug]/assinatura/SubscriptionGate.tsx`, `src/app/painel/[slug]/assinatura/actions.ts`

## Objetivo

Gerenciar o plano e a cobrança do salão via Asaas: assinar um plano, trocar de plano (upgrade/downgrade) e bloquear o acesso quando a assinatura está vencida.

## Funcionalidades

- `page.tsx` da rota `/assinatura` hoje só faz `redirect` para a aba "Assinatura" dentro de Configurações — não é mais uma página independente (o componente `SubscribePanel` é reaproveitado lá).
- **Assinar** (status trialing/past_due/sem assinatura ativa): escolha entre os planos cadastrados, campo de CPF/CNPJ do responsável (obrigatório, 11 ou 14 dígitos), botão que cria/reaproveita cliente e assinatura no Asaas e redireciona para a página de checkout hospedada (`createCheckout`).
- **Gerenciar assinatura ativa**: mostra plano atual, status, data de renovação; permite trocar de plano:
  - Upgrade: aplicado imediatamente (atualiza valor da assinatura no Asaas na hora).
  - Downgrade: agendado para o fim do ciclo atual (grava `pending_plan`; o valor da próxima cobrança já sai menor); é possível cancelar um downgrade agendado voltando a selecionar o plano atual.
- `SubscriptionGate`: tela cheia bloqueando o painel inteiro quando o salão está sem acesso (trial vencido ou pagamento pendente), exibindo o mesmo `SubscribePanel` para reativar.
- Planos cadastrados (`src/lib/plans.ts`): **Básico** (R$ 39,90 — só agendamento), **Pro** (R$ 69,90 — inclui caixa, comissões, estoque, pacotes, campanhas, relatórios), **Max** (R$ 99,90 — Pro + WhatsApp, marcado como "Em breve", não assinável ainda).
- Guarda de feature por plano (`planAllowsHref`/`guardFeature` em `src/lib/plans.ts` e `src/lib/subscription.ts`): rotas em `PRO_ONLY_HREFS` (`/campanhas`, `/recuperar`, `/pacotes`, `/financeiro`, `/relatorios`, `/estoque`) exigem plano Pro ou Max; `MAX_ONLY_HREFS` está vazio hoje (ainda sem nenhuma rota travada só para Max, incluindo `/marketing`, que tem um TODO para entrar aí quando a IA de geração for ligada).

## Permissões

- Assinar (`createCheckout`) e trocar de plano (`changePlan`) exigem que o usuário logado seja o dono do salão (`salon.owner_id === uid`); qualquer outro membro recebe erro "Apenas o dono do salão pode assinar/mudar o plano."
- Visualização do painel de assinatura (dentro de Configurações) segue a mesma regra da aba: exige `salon.manage`.

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento.

## Dados / Backend

- Tabela: `salon_subscriptions` (`plan`, `value`, `status`, `pending_plan`, `asaas_customer_id`, `asaas_subscription_id`, `trial_ends_at`).
- RPC: `salon_access_status` (leitura do status de acesso, via `getAccessStatus`).
- Integração externa: Asaas (`src/lib/asaas.ts`) — criação de cliente, criação/atualização de assinatura, URL de checkout hospedado.

## Observações

Preços dos planos são definidos em código (`src/lib/plans.ts`), não em variáveis de ambiente nem no banco — qualquer mudança de valor exige deploy.
