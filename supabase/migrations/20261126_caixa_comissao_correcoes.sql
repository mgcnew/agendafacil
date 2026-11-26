-- ─────────────────────────────────────────────────────────────────────────
-- Correções do Caixa & Comissões
--
-- pay_commission
--   • recebe a forma de pagamento (dinheiro/pix). Antes a saída entrava
--     sempre como dinheiro e um pagamento por Pix derrubava o esperado da
--     gaveta, gerando "sobra" falsa no fechamento cego.
--   • aceita pagamento parcial e recusa valor acima do pendente do período
--     (apurado em serviços concluídos + usos de pacote − já pago).
--   • trava por profissional+período, pra um duplo clique não pagar duas vezes.
--
-- cash_sell_product
--   • recusa venda acima do estoque.
--   • a movimentação sai com motivo ("Venda no caixa") e autor; a entrada no
--     caixa também registra quem lançou.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.pay_commission(uuid, uuid, numeric, date, date);

create or replace function public.pay_commission(
  p_salon uuid,
  p_member uuid,
  p_amount numeric,
  p_period_start date,
  p_period_end date,
  p_payment_method text default 'dinheiro'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session uuid;
  v_tx uuid;
  v_name text;
  v_cash boolean := false;
  v_from timestamptz := p_period_start::timestamp at time zone 'America/Sao_Paulo';
  v_to   timestamptz := (p_period_end + 1)::timestamp at time zone 'America/Sao_Paulo';
  v_earned numeric;
  v_paid numeric;
begin
  if not (has_permission(p_salon, 'commissions.manage')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_payment_method not in ('dinheiro', 'pix') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select display_name into v_name from salon_members
   where id = p_member and salon_id = p_salon;
  if not found then raise exception 'Profissional inválido.'; end if;

  perform pg_advisory_xact_lock(hashtext('pay_commission:' || p_member || ':' || p_period_start));

  select coalesce(sum(s.commission_amount), 0) into v_earned
    from appointment_services s
    join appointments a on a.id = s.appointment_id
   where s.salon_id = p_salon and a.member_id = p_member and a.status = 'completed'
     and a.starts_at >= v_from and a.starts_at < v_to;

  v_earned := v_earned + coalesce((
    select sum(r.commission_amount) from package_redemptions r
     where r.salon_id = p_salon and r.member_id = p_member
       and r.used_at >= v_from and r.used_at < v_to), 0);

  select coalesce(sum(amount), 0) into v_paid from commission_payments
   where salon_id = p_salon and member_id = p_member and period_start = p_period_start;

  if p_amount > v_earned - v_paid + 0.005 then
    raise exception 'Valor acima do pendente do período.';
  end if;

  -- saída no caixa, se houver sessão aberta
  select id into v_session from cash_sessions
   where salon_id = p_salon and closed_at is null
   order by opened_at desc limit 1;

  if v_session is not null then
    insert into cash_transactions
      (salon_id, session_id, type, category, amount, payment_method, member_id, description, created_by)
    values
      (p_salon, v_session, 'expense', 'comissao', p_amount, p_payment_method, p_member,
       'Comissão' || coalesce(' · ' || v_name, ''), auth.uid())
    returning id into v_tx;
    v_cash := true;
  end if;

  insert into commission_payments
    (salon_id, member_id, amount, period_start, period_end, cash_transaction_id, created_by)
  values
    (p_salon, p_member, p_amount, p_period_start, p_period_end, v_tx, auth.uid());

  return jsonb_build_object('cash_recorded', v_cash);
end; $$;

revoke execute on function public.pay_commission(uuid, uuid, numeric, date, date, text) from public, anon;
grant execute on function public.pay_commission(uuid, uuid, numeric, date, date, text) to authenticated;

create or replace function public.cash_sell_product(
  p_session uuid, p_product uuid, p_qty numeric, p_payment_method text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_salon uuid;
  v_price numeric;
  v_name  text;
  v_stock numeric;
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

  select sale_price, name, quantity into v_price, v_name, v_stock
  from products where id = p_product and salon_id = v_salon
  for update;
  if v_price is null then raise exception 'Produto inválido.'; end if;
  if coalesce(v_stock, 0) < p_qty then
    raise exception 'Estoque insuficiente de %: restam %.', v_name, trim_scale(coalesce(v_stock, 0));
  end if;

  insert into cash_transactions (salon_id, session_id, type, amount, description, payment_method, created_by)
  values (v_salon, p_session, 'income', v_price * p_qty,
          'Venda: ' || v_name || (case when p_qty > 1 then ' x' || trim(to_char(p_qty, 'FM999990.###')) else '' end),
          p_payment_method, auth.uid());

  update products set quantity = quantity - p_qty where id = p_product;

  insert into stock_movements (salon_id, product_id, type, quantity, reason, created_by)
  values (v_salon, p_product, 'out', p_qty, 'Venda no caixa', auth.uid());
end;
$$;
