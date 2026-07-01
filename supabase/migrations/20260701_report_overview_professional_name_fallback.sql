-- report_overview mostrava "Profissional" genérico para membros sem display_name
-- preenchido (ex.: dono que nunca configurou um apelido em Equipe). O resto do
-- sistema (Equipe, Agenda, Pacotes, Configurações) já cai para profiles.full_name
-- nesse caso — esta função ficou pra trás.
CREATE OR REPLACE FUNCTION public.report_overview(p_salon uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_faturamento numeric := 0;
  v_atendimentos int := 0;
  v_despesas numeric := 0;
  v_by_payment jsonb;
  v_daily jsonb;
  v_services jsonb;
  v_pros jsonb;
begin
  if not (has_permission(p_salon, 'reports.view')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  -- Faturamento e nº de atendimentos concluídos (por starts_at)
  select coalesce(sum(total_price), 0), count(*)
    into v_faturamento, v_atendimentos
  from appointments
  where salon_id = p_salon and status = 'completed'
    and starts_at >= p_from and starts_at <= p_to;

  -- Despesas lançadas no caixa no período (por created_at)
  select coalesce(sum(amount), 0) into v_despesas
  from cash_transactions
  where salon_id = p_salon and type = 'expense'
    and created_at >= p_from and created_at <= p_to;

  -- Faturamento por forma de pagamento
  select coalesce(jsonb_agg(jsonb_build_object('method', method, 'total', total) order by total desc), '[]'::jsonb)
    into v_by_payment
  from (
    select coalesce(nullif(payment_method, ''), 'Não informado') as method, sum(total_price) as total
    from appointments
    where salon_id = p_salon and status = 'completed'
      and starts_at >= p_from and starts_at <= p_to
    group by 1
  ) q;

  -- Série diária de faturamento (data no fuso do Brasil)
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'total', total) order by day), '[]'::jsonb)
    into v_daily
  from (
    select (starts_at at time zone 'America/Sao_Paulo')::date as day, sum(total_price) as total
    from appointments
    where salon_id = p_salon and status = 'completed'
      and starts_at >= p_from and starts_at <= p_to
    group by 1
  ) q;

  -- Top serviços (qtd e receita)
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'total', total) order by total desc), '[]'::jsonb)
    into v_services
  from (
    select asv.name, count(*) as qty, sum(asv.price) as total
    from appointment_services asv
    join appointments a on a.id = asv.appointment_id
    where asv.salon_id = p_salon and a.status = 'completed'
      and a.starts_at >= p_from and a.starts_at <= p_to
    group by asv.name
  ) q;

  -- Desempenho por profissional
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name, 'qty', qty, 'revenue', revenue, 'commission', commission
         ) order by revenue desc), '[]'::jsonb)
    into v_pros
  from (
    select
      coalesce(m.display_name, pr.full_name, 'Profissional') as name,
      (select count(*) from appointments a
        where a.salon_id = p_salon and a.status = 'completed' and a.member_id = m.id
          and a.starts_at >= p_from and a.starts_at <= p_to) as qty,
      (select coalesce(sum(a.total_price), 0) from appointments a
        where a.salon_id = p_salon and a.status = 'completed' and a.member_id = m.id
          and a.starts_at >= p_from and a.starts_at <= p_to) as revenue,
      (select coalesce(sum(asv.commission_amount), 0)
        from appointment_services asv
        join appointments a on a.id = asv.appointment_id
        where asv.salon_id = p_salon and a.status = 'completed' and a.member_id = m.id
          and a.starts_at >= p_from and a.starts_at <= p_to) as commission
    from salon_members m
    left join profiles pr on pr.id = m.profile_id
    where m.salon_id = p_salon and m.is_active
  ) q
  where q.qty > 0;

  return jsonb_build_object(
    'faturamento', v_faturamento,
    'atendimentos', v_atendimentos,
    'despesas', v_despesas,
    'liquido', v_faturamento - v_despesas,
    'ticket_medio', case when v_atendimentos > 0 then round(v_faturamento / v_atendimentos, 2) else 0 end,
    'by_payment', v_by_payment,
    'daily', v_daily,
    'services', coalesce(v_services, '[]'::jsonb),
    'professionals', coalesce(v_pros, '[]'::jsonb)
  );
end;
$function$;
