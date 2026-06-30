-- ─────────────────────────────────────────────────────────────────────────
-- Estimativa de faturamento por horário vazio na Agenda (v2 do roadmap de IA)
--
-- Calcula o ticket médio histórico por dia-da-semana + hora, a partir de
-- atendimentos concluídos numa janela (default 90 dias). Usado para estimar
-- quanto os horários livres de hoje "valeriam" com base no padrão do salão.
--
-- Guard de amostra: o cliente (AgendaManager) só usa o valor se
-- sample_count >= MIN_SAMPLES — evita mostrar estimativa enganosa com
-- pouco histórico. Ver docs/produto/zulan-2.0-roadmap-ia.md.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.agenda_revenue_by_hour(
  p_salon uuid,
  p_weekday integer,
  p_window_days integer default 90
)
returns table(hour_bucket integer, avg_ticket numeric, sample_count integer)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_tz text;
begin
  if not (has_permission(p_salon, 'reports.view')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  select coalesce(timezone, 'America/Sao_Paulo') into v_tz from salons where id = p_salon;

  return query
    select
      extract(hour from (a.starts_at at time zone v_tz))::int as hour_bucket,
      avg(a.total_price)::numeric as avg_ticket,
      count(*)::int as sample_count
    from appointments a
    where a.salon_id = p_salon
      and a.status = 'completed'
      and a.starts_at >= now() - make_interval(days => p_window_days)
      and extract(dow from (a.starts_at at time zone v_tz)) = p_weekday
    group by 1;
end;
$$;
