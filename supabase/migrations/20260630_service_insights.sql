-- ─────────────────────────────────────────────────────────────────────────
-- Histórico real de uso por serviço (v1 do roadmap de IA — página Serviços)
--
-- Hoje a margem só é estimada na hora de cadastrar o serviço, nunca
-- confrontada com o que de fato aconteceu. Esta RPC junta o histórico real
-- (appointment_services, já com preço e comissão snapshotados no momento do
-- atendimento) pra alimentar: quantas vezes foi agendado, receita real,
-- comissão média real e quando foi a última vez que alguém pediu.
--
-- Serviço ativo que não aparece no resultado (zero linhas) = sem nenhum
-- agendamento concluído na janela — "serviço parado", calculado no cliente.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.service_insights(p_salon uuid, p_window_days integer default 90)
returns table(service_id uuid, bookings integer, revenue numeric, avg_commission numeric, last_booked timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    aps.service_id,
    count(*)::int as bookings,
    coalesce(sum(aps.price), 0) as revenue,
    coalesce(avg(aps.commission_amount), 0) as avg_commission,
    max(a.starts_at) as last_booked
  from appointment_services aps
  join appointments a on a.id = aps.appointment_id
  where aps.salon_id = p_salon
    and a.status = 'completed'
    and a.starts_at >= now() - make_interval(days => p_window_days)
    and aps.service_id is not null
    and is_salon_member(p_salon)
  group by aps.service_id;
$$;
