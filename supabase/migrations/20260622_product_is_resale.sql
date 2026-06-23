-- Distingue insumo (consumido no serviço, só custo) de produto de revenda
-- (vendido direto, com preço de venda). Insumos não usam sale_price.
alter table products
  add column if not exists is_resale boolean not null default false;

-- Backfill: produtos que já têm preço de venda viram "revenda".
update products set is_resale = true where sale_price > 0 and is_resale = false;
