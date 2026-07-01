# Financeiro (Caixa & Comissões)

Rota: `/painel/[slug]/financeiro`
Arquivo principal: `src/app/painel/[slug]/financeiro/page.tsx` + `src/app/painel/[slug]/financeiro/FinanceManager.tsx` (+ `FixedCostsPanel.tsx`, `receipt.ts`)

## Objetivo

Operar o caixa do dia a dia do salão (receber atendimentos, vender produtos avulsos, lançar entradas/saídas, fechar caixa), acompanhar histórico de fechamentos, apurar e pagar comissão dos profissionais, e controlar custos fixos mensais — tudo com narrador de IA apontando anomalias e resumos.

## Funcionalidades

### Caixa (PDV ao vivo)
- Abrir caixa com valor de abertura livre (`cash_sessions`).
- Busca unificada de cliente/produto e atalhos de teclado (F2 Receber, F3 Lançar, F4 Histórico, F8 Fechar, F9 Concluir, `/` foca busca, Esc cancela) — ativos só com caixa aberto, sem modal aberto e para quem pode operar.
- **Receber**: lista atendimentos do dia ainda não cobrados (RPC `receivable_today`), permite adicionar produtos de revenda ao checkout, aplicar desconto (se habilitado) e dividir pagamento em múltiplas formas (só quando não há produto no checkout). Confirma via `finalize_appointment` + `cash_sell_product` por produto extra.
- **Carrinho avulso**: produtos sem cliente vinculado, pagos via seletor de forma de pagamento, um `cash_sell_product` por item.
- **Loja**: busca de produtos de revenda para adicionar ao checkout/carrinho.
- **Venda avulsa de produto único** com seletor de quantidade.
- **Lançar**: Suprimento (entrada de troco), Sangria (retirada), Entrada avulsa, Saída/despesa — Sangria/Suprimento sempre em dinheiro e não entram no resultado income/expense, só no dinheiro físico esperado.
- **Histórico do dia**: lista movimentações da sessão aberta; permite emitir cupom (PDF térmico 80mm + WhatsApp) e estornar (RPC `reverse_cash_transaction` — devolve o atendimento a "Receber" se for cobrança, remove se for avulso).
- **Fechar caixa**: fechamento "cego" (usuário digita a contagem física sem ver o valor esperado do sistema); grava fechamento em `cash_sessions` e mostra tela de sucesso com narrador, conferência por forma de pagamento, PDF e envio via WhatsApp.

### Caixas anteriores (histórico)
- Lista os últimos 8 caixas fechados; ao clicar, abre detalhe com resumo financeiro completo, entradas por forma, lista de movimentações, PDF e WhatsApp.
- Reabrir caixa (RPC `reopen_cash_session`) — só quem pode operar, só se não há caixa aberto no momento e só para o fechamento mais recente.

### Comissões
- Navegação por mês.
- Lista de profissionais com comissão apurada no período (serviços concluídos + uso de pacote), mostrando apurado/pago/pendente.
- Detalhe por profissional (linha a linha, serviço/base/%/comissão), botão "Confirmar pagamento" (RPC `pay_commission`), gerar comprovante em PDF e enviar por WhatsApp.

### Fixos
- CRUD de despesas fixas e receitas previstas manuais (tabela `fixed_costs`, exclusão é soft-delete via `is_active=false`).
- Exibição automática (não editável ali) de aluguéis de cadeira ativos e valor total em pacotes vendidos e ainda não entregues.
- Cards de resumo: receitas previstas, despesas fixas, resultado mensal líquido.

## Permissões

- `guardFeature(slug, "/financeiro")`: gate de plano/assinatura para a página inteira.
- `canManage = membership.role !== "professional"`: controla quem pode operar o caixa (abrir/lançar/fechar/vender/estornar/pagar comissão/reabrir); profissionais têm acesso só de leitura.
- `perms.has("cash.commissions.view")`: controla se a aba **Comissões** aparece.
- `perms.has("cash.fixed.view")`: controla se a aba **Fixos** aparece (inclusive as queries relacionadas só rodam se tiver a permissão).
- `perms.has("cash.discount")` + `salons.cash_discount_enabled`: habilita desconto no checkout; `salons.cash_max_discount_percent` limita o valor máximo.
- Permissões granulares liberadas individualmente pelo dono por membro (não são fixas por role).

## Inteligência (IA)

Sim — componente `Narrator` (`src/components/Narrator.tsx`) em cada uma das 4 abas, sempre só narrando/linkando, nunca disparando ação sozinho.

- **Caixa (tela de sucesso do fechamento)**: aparece só se `historicalCount >= 3` (últimos 8 fechamentos com diferença registrada) e `|diferença| >= R$5` e `|diferença| > 1.5×` a média histórica das diferenças absolutas. Ex.: "Essa falta/sobra de R$X está acima do normal (média das últimas N contagens: R$Y)."
- **Caixas anteriores**: mesmo piso (≥3 fechamentos com diferença). Sem faltas no período, comemora a organização; com 2+ faltas, narra quantidade e média, e se ≥60% delas caíram com o mesmo operador (`closed_by`), menciona em tom neutro.
- **Comissões**: sempre que há ao menos 1 comissão no período (sem piso de amostra), destaca quem mais gerou comissão (maior `earned`) e, se houver total pendente (`> R$0,01`), alerta o valor de comissões apuradas e ainda não pagas.
- **Fixos**: cruza custos fixos mensais com o faturamento do mês passado (reaproveita `report_overview`) para narrar que fatia da receita os custos fixos consomem, e lembra do valor em pacotes vendidos e ainda não entregues (passivo de serviço).

## Dados / Backend

- Tabelas: `cash_sessions`, `cash_transactions`, `salon_members`, `profiles`, `appointment_services`, `appointments`, `package_redemptions`, `commission_payments`, `products`, `salons`, `fixed_costs`, `salon_member_details`, `client_packages`, `clients`.
- RPCs: `receivable_today`, `report_overview` (reaproveitada de Relatórios), `reverse_cash_transaction`, `finalize_appointment`, `cash_sell_product`, `reopen_cash_session`, `pay_commission`.

## Observações

- Dinheiro físico esperado = abertura + todas entradas em dinheiro − todas saídas em dinheiro, incluindo sangria/suprimento (que afetam a gaveta física mas não entram no total income/expense exibido).
- Split de pagamento exige 2+ formas somando exatamente o total líquido, e só é permitido quando o checkout não tem produtos.
- Fechamento é sempre "cego": o operador não vê os valores esperados do sistema antes de digitar a contagem, para evitar viés.
- Bug já corrigido (2026-07-01): fallback de nome ausente (`display_name` vazio mostrando "Profissional" genérico) nas queries de comissões e de quem abriu/fechou o caixa — corrigido adicionando `profiles(full_name)` como fallback no `select`.
- Fora do escopo atual: as abas "Inteligência"/"Crescimento"/"Assistente IA" de uma visão mais ampla descritas em outro documento não existem nesta página real, que é só Caixa & Comissões; sugestão automática de ajuste de preço/desconto e envio automático do resumo de fechamento também não existem.
