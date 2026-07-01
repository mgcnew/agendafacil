-- ─────────────────────────────────────────────────────────────────────────
-- Atribuição de campanha por agendamento (v2 do roadmap de IA — página
-- Campanhas: medição de performance)
--
-- Hoje o desconto de campanha é calculado e gravado em appointment_services
-- .price, mas qual campanha (se alguma) gerou aquele desconto nunca é
-- guardado — impossível saber quantos agendamentos/quanta receita uma
-- campanha específica gerou. Esta migration:
--   1. adiciona appointment_services.campaign_id e .original_price;
--   2. extrai a lógica de elegibilidade de campaign_discount() para
--      campaign_for_service(), que retorna também o id da campanha vencedora
--      (mantendo campaign_discount() com a mesma assinatura/comportamento,
--      só que agora implementada em cima da nova função);
--   3. atualiza _appt_fill() (usada por book_appointment e
--      create_staff_appointment) pra gravar campaign_id/original_price;
--   4. adiciona campaign_performance(), que agrega agendamentos/receita/
--      desconto concedido por campanha, só para atendimentos 'completed'.
--
-- Escopo desta primeira versão: apenas serviços (appointment_services).
-- Venda de produto no caixa não é atribuída a campanha nesta v2.
--
-- Limitação conhecida: dados só existem a partir de quando esta migration
-- entrar no ar — não há como reconstruir atribuição de agendamentos
-- passados, pois a campanha nunca foi gravada antes disso.
-- ─────────────────────────────────────────────────────────────────────────

alter table appointment_services
  add column if not exists campaign_id uuid references campaigns(id) on delete set null,
  add column if not exists original_price numeric(10,2);

create or replace function public.campaign_for_service(p_salon uuid, p_service uuid, p_on date)
returns table(campaign_id uuid, discount_percent numeric)
language sql
stable security definer
set search_path to 'public'
as $$
  select c.id, c.discount_percent
  from campaigns c
  where c.salon_id = p_salon
    and c.is_active
    and (c.starts_on is null or c.starts_on <= p_on)
    and (c.ends_on   is null or c.ends_on   >= p_on)
    and (
      c.scope = 'all'
      or exists (
        select 1 from campaign_services cs
        where cs.campaign_id = c.id and cs.service_id = p_service
      )
    )
  order by c.discount_percent desc
  limit 1;
$$;

create or replace function public.campaign_discount(p_salon uuid, p_service uuid, p_on date)
returns numeric
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce((select discount_percent from campaign_for_service(p_salon, p_service, p_on)), 0);
$$;

create or replace function public._appt_fill(p_salon uuid, p_appt uuid, p_member uuid, p_service_ids uuid[], p_starts_at timestamp with time zone, p_member_commission numeric)
 returns timestamp with time zone
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare s record; cur timestamptz := p_starts_at; bs timestamptz; be timestamptz; comm numeric;
  v_on date := (p_starts_at at time zone 'America/Sao_Paulo')::date; eff numeric;
  v_chair boolean := false;
  v_camp uuid; v_disc numeric;
begin
  v_chair := coalesce((select employment_type = 'chair_rent' from salon_member_details where member_id = p_member), false);
  for s in
    select id, name, duration_min, processing_time_min, finish_time_min, price, price_type, commission_percent
    from services where salon_id = p_salon and id = any(p_service_ids)
    order by array_position(p_service_ids, id)
  loop
    comm := case when v_chair then 0 else coalesce(s.commission_percent, p_member_commission, 0) end;

    if s.price_type = 'on_request' then
      v_camp := null; v_disc := 0; eff := s.price;
    else
      select cf.campaign_id, cf.discount_percent into v_camp, v_disc
      from campaign_for_service(p_salon, s.id, v_on) cf;
      eff := round(s.price * (1 - coalesce(v_disc, 0) / 100), 2);
    end if;

    insert into appointment_services (salon_id, appointment_id, service_id, name, duration_min, price, commission_percent, commission_amount, campaign_id, original_price)
    values (p_salon, p_appt, s.id, s.name,
            s.duration_min + s.processing_time_min + s.finish_time_min,
            eff, comm, round(eff * comm / 100, 2), v_camp, s.price);

    if s.processing_time_min > 0 then
      bs := cur; be := cur + make_interval(mins => s.duration_min);
      insert into appointment_segments (salon_id, appointment_id, member_id, starts_at, ends_at)
      values (p_salon, p_appt, p_member, bs, be);
      if s.finish_time_min > 0 then
        bs := cur + make_interval(mins => s.duration_min + s.processing_time_min);
        be := bs + make_interval(mins => s.finish_time_min);
        insert into appointment_segments (salon_id, appointment_id, member_id, starts_at, ends_at)
        values (p_salon, p_appt, p_member, bs, be);
      end if;
      cur := cur + make_interval(mins => s.duration_min + s.processing_time_min + s.finish_time_min);
    else
      bs := cur; be := cur + make_interval(mins => s.duration_min + s.finish_time_min);
      insert into appointment_segments (salon_id, appointment_id, member_id, starts_at, ends_at)
      values (p_salon, p_appt, p_member, bs, be);
      cur := cur + make_interval(mins => s.duration_min + s.finish_time_min);
    end if;
  end loop;
  return cur;
end; $function$;

create or replace function public.campaign_performance(p_salon uuid)
returns table(
  campaign_id uuid,
  campaign_name text,
  bookings integer,
  revenue numeric,
  discount_given numeric
)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    c.id,
    c.name,
    count(x.id)::int as bookings,
    coalesce(sum(x.price), 0) as revenue,
    coalesce(sum(x.original_price - x.price), 0) as discount_given
  from campaigns c
  left join (
    select aps.id, aps.campaign_id, aps.price, aps.original_price
    from appointment_services aps
    join appointments a on a.id = aps.appointment_id
    where a.status = 'completed'
  ) x on x.campaign_id = c.id
  where c.salon_id = p_salon
    and is_salon_member(p_salon)
  group by c.id, c.name
  order by revenue desc;
$$;
