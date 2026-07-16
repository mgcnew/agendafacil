-- Exclui salões demo (is_demo) das métricas e da listagem do painel /admin,
-- pra não poluir MRR, conversão, churn, contagem e a aba de salões.
-- salon_access_status NÃO muda: o demo tem acesso normal (assinatura marcada
-- como ativa à parte). Ver 20260716_salons_is_demo.sql.

create or replace function public.admin_metrics()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  m_mrr numeric; m_active int; m_trialing int; m_past int; m_canceled int; m_total int;
  m_canceled30 int; m_new30 int; m_newmonth int;
  series jsonb;
  mrr_series jsonb;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;

  select
    coalesce(sum(sub.value) filter (where sub.status = 'active'), 0),
    count(*) filter (where sub.status = 'active'),
    count(*) filter (where sub.status = 'trialing'),
    count(*) filter (where sub.status = 'past_due'),
    count(*) filter (where sub.status = 'canceled'),
    count(*),
    count(*) filter (where sub.status = 'canceled' and sub.updated_at >= now() - interval '30 days')
  into m_mrr, m_active, m_trialing, m_past, m_canceled, m_total, m_canceled30
  from salon_subscriptions sub
  join salons s on s.id = sub.salon_id
  where not s.is_demo;

  select count(*) into m_new30 from salons where created_at >= now() - interval '30 days' and not is_demo;
  select count(*) into m_newmonth from salons where created_at >= date_trunc('month', now()) and not is_demo;

  with months as (
    select date_trunc('month', now()) - (i || ' months')::interval as mth
    from generate_series(0, 11) as i
  ),
  counts as (
    select date_trunc('month', created_at) as mth, count(*) as c
    from salons
    where created_at >= date_trunc('month', now()) - interval '11 months' and not is_demo
    group by 1
  )
  select jsonb_agg(jsonb_build_object('month', to_char(months.mth, 'YYYY-MM'), 'count', coalesce(counts.c, 0)) order by months.mth)
    into series
  from months left join counts on counts.mth = months.mth;

  with months as (
    select date_trunc('month', now()) - (i || ' months')::interval as mth
    from generate_series(0, 11) as i
  )
  select jsonb_agg(
           jsonb_build_object(
             'month', to_char(m.mth, 'YYYY-MM'),
             'mrr', coalesce((
               select sum(s.value) from salon_subscriptions s
               join salons sa on sa.id = s.salon_id
               where s.status = 'active'
                 and not sa.is_demo
                 and s.trial_ends_at <= (m.mth + interval '1 month' - interval '1 second')
             ), 0)
           ) order by m.mth
         )
    into mrr_series
  from months m;

  return jsonb_build_object(
    'mrr', m_mrr, 'arr', m_mrr * 12,
    'arpu', case when m_active > 0 then round(m_mrr / m_active, 2) else 0 end,
    'active', m_active, 'trialing', m_trialing, 'past_due', m_past,
    'canceled', m_canceled, 'total', m_total, 'canceled_30d', m_canceled30,
    'new_30d', m_new30, 'new_this_month', m_newmonth,
    'conversion', case when (m_active + m_canceled + m_past) > 0
                       then round(m_active::numeric / (m_active + m_canceled + m_past) * 100, 1) else 0 end,
    'churn_30d', case when (m_active + m_canceled30) > 0
                      then round(m_canceled30::numeric / (m_active + m_canceled30) * 100, 1) else 0 end,
    'series', coalesce(series, '[]'::jsonb),
    'mrr_series', coalesce(mrr_series, '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_list_salons()
 returns table(salon_id uuid, name text, slug text, created_at timestamp with time zone, is_active boolean, owner_name text, owner_email text, plan text, status text, value numeric, trial_ends_at timestamp with time zone, current_period_end timestamp with time zone, appts_30d integer, clients_count integer, members_count integer, last_activity timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
  select
    s.id, s.name, s.slug, s.created_at, s.is_active,
    p.full_name, p.email,
    sub.plan, sub.status, sub.value, sub.trial_ends_at, sub.current_period_end,
    (select count(*)::int from appointments a where a.salon_id = s.id and a.created_at >= now() - interval '30 days'),
    (select count(*)::int from clients c where c.salon_id = s.id),
    (select count(*)::int from salon_members m where m.salon_id = s.id and m.is_active),
    (select max(a.created_at) from appointments a where a.salon_id = s.id)
  from salons s
  left join profiles p on p.id = s.owner_id
  left join salon_subscriptions sub on sub.salon_id = s.id
  where not s.is_demo
  order by s.created_at desc;
end;
$function$;
