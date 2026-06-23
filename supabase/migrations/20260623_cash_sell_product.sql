-- Venda rápida de produto (revenda) no caixa: lança entrada + baixa estoque
-- atomicamente. Sem comissão. Checa que o chamador é membro do salão.
create or replace function cash_sell_product(
  p_session uuid, p_product uuid, p_qty numeric, p_payment_method text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_salon uuid;
  v_price numeric;
  v_name  text;
begin
  select salon_id into v_salon from cash_sessions where id = p_session and closed_at is null;
  if v_salon is null then raise exception 'Caixa fechado.'; end if;

  if not exists (
    select 1 from salon_members
    where salon_id = v_salon and profile_id = auth.uid() and is_active = true
  ) then
    raise exception 'not authorized';
  end if;

  if coalesce(p_qty, 0) <= 0 then raise exception 'Quantidade inválida.'; end if;

  select sale_price, name into v_price, v_name
  from products where id = p_product and salon_id = v_salon;
  if v_price is null then raise exception 'Produto inválido.'; end if;

  insert into cash_transactions (salon_id, session_id, type, amount, description, payment_method)
  values (
    v_salon, p_session, 'income', v_price * p_qty,
    'Venda: ' || v_name || (case when p_qty > 1 then ' x' || trim(to_char(p_qty, 'FM999990.###')) else '' end),
    p_payment_method
  );

  update products set quantity = quantity - p_qty where id = p_product;

  insert into stock_movements (salon_id, product_id, type, quantity)
  values (v_salon, p_product, 'out', p_qty);
end;
$$;
