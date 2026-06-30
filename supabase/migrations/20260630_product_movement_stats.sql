-- ─────────────────────────────────────────────────────────────────────────
-- Consumo real por produto (v1 do roadmap de IA — página Estoque)
--
-- stock_movements já é alimentado automaticamente: finalize_appointment()
-- baixa insumo por atendimento (type='out', reason='Atendimento') e
-- cash_sell_product() baixa revenda vendida no caixa (type='out'). Esta RPC
-- só agrega o que já existe, numa janela (default 30 dias), pra alimentar
-- "dias até acabar" e "produto parado".
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.product_movement_stats(p_salon uuid, p_window_days integer default 30)
returns table(product_id uuid, consumed_qty numeric, movements_count integer, last_movement_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    sm.product_id,
    coalesce(sum(sm.quantity), 0) as consumed_qty,
    count(*)::int as movements_count,
    max(sm.created_at) as last_movement_at
  from stock_movements sm
  where sm.salon_id = p_salon
    and sm.type = 'out'
    and sm.created_at >= now() - make_interval(days => p_window_days)
    and is_salon_member(p_salon)
  group by sm.product_id;
$$;
