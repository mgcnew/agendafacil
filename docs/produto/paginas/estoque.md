# Estoque

Rota: `/painel/[slug]/estoque`
Arquivo principal: `src/app/painel/[slug]/estoque/page.tsx` + `InventoryManager.tsx`

## Objetivo

Controlar quantidade, custo e movimentação de produtos (insumos usados em serviços e itens de revenda), incluindo baixas automáticas geradas por atendimentos e vendas.

## Funcionalidades

- Cadastro de produto: nome, quantidade inicial, quantidade mínima (para alerta de estoque baixo), preço de custo, e — se marcado como "revenda" (`is_resale`) — preço de venda.
- Ajuste manual de estoque por botões +/- (grava também um registro em `stock_movements` do tipo `in`/`out`).
- Exclusão de produto (bloqueada pelo banco se houver movimentações/atendimentos vinculados — o front reverte a remoção otimista e mostra erro).
- Busca por nome, filtro por tipo (revenda / insumo) e filtro por status (Todos / Estoque baixo / Parado).
- Alerta fixo no topo listando produtos no estoque mínimo (`quantity <= min_quantity`, com `min_quantity > 0`).
- Lista de produtos mostra, por item: badge revenda/insumo, badge "parado há 30+ dias" (produto de revenda ativo sem consumo no período), custo/preço de venda, lucro (venda − custo, só para revenda), consumo real nos últimos 30 dias e estimativa "acaba em ~Xd" quando há ritmo de consumo detectável.
- Paginação da lista de produtos (15 por página).
- "Movimentações recentes": histórico de entradas/saídas/ajustes (inclui baixas automáticas geradas por atendimentos concluídos e vendas no caixa), carregado em lotes de 10 com botão "Carregar mais" (server action `loadMoreMovements`).

## Permissões

`canManage = membership.role === "owner" || membership.role === "manager"` (calculado no server component, não via `getEffectivePermissions`). Sem essa role, os botões de cadastrar produto, ajustar quantidade e excluir não aparecem — a página vira somente leitura.

Página também passa por `guardFeature(slug, "/estoque")` — checagem de acesso por plano de assinatura do salão.

## Inteligência (IA)

Não há LLM. Há cálculo de "insights" de consumo real, classificado no roadmap como v1 de IA para Estoque mas implementado como cálculo direto sobre `stock_movements` (explicitamente documentado no código como "sem IA generativa"):
- RPC `product_movement_stats` retorna, por produto, quantidade consumida, número de movimentações e data da última movimentação nos últimos 30 dias.
- Usado para: badge de produto "parado" (revenda ativo sem nenhum consumo em 30 dias), exibição do consumo real do período, e estimativa de dias até acabar o estoque (`daysUntilStockout`, baseada na taxa diária de consumo do período — retorna `null` quando não há consumo recente suficiente para estimar).
- Sem texto narrado por IA nem componente tipo "Gestor Zulan" nesta página — os números aparecem direto nos badges da lista.

## Dados / Backend

- Tabelas: `products`, `stock_movements`.
- RPC: `product_movement_stats`.
- Helpers: `buildProductInsightMap`, `daysUntilStockout` (`src/lib/productInsights.ts`).
- `getMembershipBySlug`, `guardFeature`.

## Observações

- Página roda com `export const dynamic = "force-dynamic"`.
- Baixas de estoque também acontecem fora desta página: ao finalizar um atendimento (Agenda/Dashboard) que consome insumos vinculados a um serviço, e possivelmente em vendas avulsas no caixa/financeiro — essas baixas aparecem aqui como "Movimentações recentes", mas a lógica de geração fica em outras páginas/RPCs (ex.: `finalize_appointment`).
