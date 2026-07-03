-- ─────────────────────────────────────────────────────────────────────────
-- Trava contra reprocessar um atendimento já cobrado. O dropdown de Status
-- na Agenda permite jogar um agendamento completed de volta pra confirmed
-- livremente; isso reabre "Finalizar atendimento" e uma segunda chamada não
-- duplicava a entrada no caixa (guard de idempotência já existia pra isso),
-- mas sobrescrevia appointments.payment_method/status silenciosamente, sem
-- tocar o caixa — causando descompasso entre o que foi cobrado de verdade
-- e o que ficou registrado no agendamento.
--
-- Não pode bloquear todo re-finalize: o fluxo de Estornar
-- (reverse_cash_transaction) deixa o status em 'completed' de propósito e
-- apaga a cash_transaction de income antes, justamente pra permitir cobrar
-- de novo depois. A trava certa: bloqueia sempre que já existe uma
-- cash_transactions de income pra esse atendimento — não confia no status
-- atual (uma primeira versão desta guarda checava "status = completed", mas
-- isso não pega o caso real: o status já foi trocado pelo dropdown antes de
-- finalizar de novo; testado ao vivo e corrigido).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.finalize_appointment(
  p_appointment uuid,
  p_payment_method text default null::text,
  p_discount numeric default 0,
  p_splits jsonb default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid;
  v_member uuid;
  v_total numeric;
  v_status appointment_status;
  v_session uuid;
  v_comm_total numeric := 0;
  v_client text;
  v_cash_recorded boolean := false;
  v_warnings text[] := '{}';
  r record;
  v_newqty numeric;
  v_pname text;
  v_disc numeric := greatest(0, coalesce(p_discount, 0));
  v_net numeric;
  v_desc text;
  v_split jsonb;
  v_pay_method text;
begin
  select a.salon_id, a.member_id, a.total_price, a.status, c.full_name
    into v_salon, v_member, v_total, v_status, v_client
  from appointments a
  left join clients c on c.id = a.client_id
  where a.id = p_appointment;

  if v_salon is null then raise exception 'appointment_not_found'; end if;
  if not is_salon_member(v_salon) then raise exception 'forbidden'; end if;

  if exists (select 1 from cash_transactions where appointment_id = p_appointment and type = 'income') then
    raise exception 'already_finalized';
  end if;

  -- desconto não pode passar do total
  v_disc := least(v_disc, coalesce(v_total, 0));
  v_net  := coalesce(v_total, 0) - v_disc;

  -- 1) comissão por serviço (SOBRE O PREÇO CHEIO — desconto não afeta comissão)
  update appointment_services asv set
    commission_percent = eff.pct,
    commission_amount  = round(asv.price * eff.pct / 100.0, 2)
  from (
    select x.id,
      case when d.employment_type = 'chair_rent' then 0
           else coalesce(ps.commission_percent, s.commission_percent, m.commission_percent, 0) end as pct
    from appointment_services x
    left join professional_services ps on ps.member_id = v_member and ps.service_id = x.service_id
    left join services s on s.id = x.service_id
    left join salon_members m on m.id = v_member
    left join salon_member_details d on d.member_id = v_member
    where x.appointment_id = p_appointment
  ) eff
  where asv.id = eff.id;

  select coalesce(sum(commission_amount), 0) into v_comm_total
  from appointment_services where appointment_id = p_appointment;

  -- 2) baixa de insumos (apenas na primeira finalização)
  if v_status is distinct from 'completed' then
    for r in
      select sp.product_id, sum(sp.quantity) as qty
      from appointment_services asv
      join service_products sp on sp.service_id = asv.service_id and sp.salon_id = v_salon
      where asv.appointment_id = p_appointment
      group by sp.product_id
    loop
      update products set quantity = quantity - r.qty
       where id = r.product_id
       returning quantity, name into v_newqty, v_pname;
      insert into stock_movements (salon_id, product_id, type, quantity, reason, appointment_id, created_by)
      values (v_salon, r.product_id, 'out', r.qty, 'Atendimento', p_appointment, auth.uid());
      if v_newqty < 0 then
        v_warnings := array_append(v_warnings, v_pname);
      end if;
    end loop;
  end if;

  -- 3) determina payment_method para registrar no appointment
  if p_splits is not null and jsonb_array_length(p_splits) > 1 then
    v_pay_method := 'split';
  elsif p_splits is not null and jsonb_array_length(p_splits) = 1 then
    v_pay_method := p_splits->0->>'method';
  else
    v_pay_method := p_payment_method;
  end if;

  -- 4) conclui + forma de pagamento
  update appointments
     set status = 'completed',
         payment_method = coalesce(v_pay_method, payment_method),
         updated_at = now()
   where id = p_appointment;

  -- 5) receita no caixa
  select id into v_session from cash_sessions
   where salon_id = v_salon and closed_at is null
   order by opened_at desc limit 1;

  v_desc := 'Atendimento' || coalesce(' · ' || v_client, '')
            || case when v_disc > 0 then ' (desc. ' || trim(to_char(v_disc, 'FM999990.00')) || ')' else '' end;

  if v_session is not null and v_net > 0 then

    if p_splits is not null and jsonb_array_length(p_splits) > 0 then
      -- Uma transação por split
      for v_split in select * from jsonb_array_elements(p_splits)
      loop
        insert into cash_transactions
          (salon_id, session_id, type, category, amount, payment_method, appointment_id, member_id, description, created_by)
        values
          (v_salon, v_session, 'income', 'atendimento',
           (v_split->>'amount')::numeric,
           v_split->>'method',
           p_appointment, v_member, v_desc, auth.uid());
      end loop;
    else
      -- Transação única (comportamento anterior)
      insert into cash_transactions
        (salon_id, session_id, type, category, amount, payment_method, appointment_id, member_id, description, created_by)
      values
        (v_salon, v_session, 'income', 'atendimento', v_net, p_payment_method, p_appointment, v_member, v_desc, auth.uid());
    end if;

    v_cash_recorded := true;
  end if;

  return jsonb_build_object(
    'cash_recorded', v_cash_recorded,
    'commission_total', v_comm_total,
    'amount', v_net,
    'discount', v_disc,
    'stock_warnings', to_jsonb(v_warnings)
  );
end; $function$;
