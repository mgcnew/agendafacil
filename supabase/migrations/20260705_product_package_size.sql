-- ─────────────────────────────────────────────────────────────────────────
-- Estoque por peso/volume para insumos (gramas/ml).
--
-- Reaproveita products.unit ('un' | 'g' | 'ml') e adiciona package_size:
-- quantos gramas/ml cabem numa embalagem. O dono compra por embalagem mas
-- consome por grama — quantity/min_quantity passam a ser guardados na unidade
-- base (g/ml), e cost_price continua sendo o custo POR EMBALAGEM.
--
-- A baixa de insumo (finalize_appointment) já subtrai a receita da quantity;
-- se ambos estiverem em gramas, funciona sem alterar a função. Por isso aqui
-- só entra a coluna nova. Produtos existentes ficam com package_size = 1 e
-- unit = 'un' (comportamento atual inalterado).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists package_size numeric not null default 1;
