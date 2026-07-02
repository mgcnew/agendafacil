-- ─────────────────────────────────────────────────────────────────────────
-- Rastreia quando o dono chamou o cliente (clique em "Chamar" no WhatsApp,
-- página /recuperar). Sem isso o Gestor Zulan continuava sugerindo reativar
-- alguém que o dono já tinha acabado de chamar — o sistema não tinha como
-- saber que a ação sugerida já foi feita.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.clients add column last_contacted_at timestamptz;

create or replace function public.report_reactivation(p_salon uuid, p_min_days integer default 14)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  if not (has_permission(p_salon, 'reports.view')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  with base as (
    select
      c.id,
      c.full_name as name,
      c.phone,
      s.visits,
      s.total_spent,
      s.first_visit,
      s.last_visit,
      extract(day from (now() - s.last_visit))::int as days_since,
      -- cadência do próprio cliente; 1 visita só → fallback de 30 dias
      case when s.visits >= 2
           then greatest(round(extract(epoch from (s.last_visit - s.first_visit)) / 86400.0 / (s.visits - 1))::int, 1)
           else 30 end as expected_interval
    from clients c
    join lateral (
      select count(*) as visits,
             min(a.starts_at) as first_visit,
             max(a.starts_at) as last_visit,
             coalesce(sum(a.total_price), 0) as total_spent
      from appointments a
      where a.salon_id = p_salon and a.client_id = c.id and a.status = 'completed'
    ) s on true
    where c.salon_id = p_salon and s.visits >= 1
      -- snoozado: já foi chamado recentemente, dá um tempo antes de sugerir de novo
      and (c.last_contacted_at is null or c.last_contacted_at <= now() - interval '7 days')
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.overdue_by desc, x.total_spent desc), '[]'::jsonb)
  into v
  from (
    select
      id, name, phone, visits, total_spent, expected_interval, days_since,
      (last_visit at time zone 'America/Sao_Paulo')::date as last_visit,
      (days_since - expected_interval) as overdue_by
    from base
    where days_since >= p_min_days
      and days_since > expected_interval * 1.5
    order by overdue_by desc, total_spent desc
    limit 100
  ) x;

  return v;
end;
$function$;
