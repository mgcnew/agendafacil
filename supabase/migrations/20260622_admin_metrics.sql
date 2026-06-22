-- ─────────────────────────────────────────────────────────────────────────
-- Métricas SaaS para o Painel da Plataforma.
-- Retorna um único JSON com KPIs + série mensal de novos salões (12 meses).
-- Reaproveita is_platform_admin() do painel admin.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function admin_metrics()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  m_mrr numeric; m_active int; m_trialing int; m_past int; m_canceled int; m_total int;
  m_canceled30 int; m_new30 int; m_newmonth int;
  series jsonb;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;

  select
    coalesce(sum(value) filter (where status = 'active'), 0),
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'trialing'),
    count(*) filter (where status = 'past_due'),
    count(*) filter (where status = 'canceled'),
    count(*),
    count(*) filter (where status = 'canceled' and updated_at >= now() - interval '30 days')
  into m_mrr, m_active, m_trialing, m_past, m_canceled, m_total, m_canceled30
  from salon_subscriptions;

  select count(*) into m_new30 from salons where created_at >= now() - interval '30 days';
  select count(*) into m_newmonth from salons where created_at >= date_trunc('month', now());

  -- Novos salões por mês nos últimos 12 meses (preenche meses sem cadastro).
  with months as (
    select date_trunc('month', now()) - (i || ' months')::interval as mth
    from generate_series(0, 11) as i
  ),
  counts as (
    select date_trunc('month', created_at) as mth, count(*) as c
    from salons
    where created_at >= date_trunc('month', now()) - interval '11 months'
    group by 1
  )
  select jsonb_agg(
           jsonb_build_object('month', to_char(months.mth, 'YYYY-MM'), 'count', coalesce(counts.c, 0))
           order by months.mth
         )
    into series
  from months left join counts on counts.mth = months.mth;

  return jsonb_build_object(
    'mrr', m_mrr,
    'arr', m_mrr * 12,
    'arpu', case when m_active > 0 then round(m_mrr / m_active, 2) else 0 end,
    'active', m_active,
    'trialing', m_trialing,
    'past_due', m_past,
    'canceled', m_canceled,
    'total', m_total,
    'canceled_30d', m_canceled30,
    'new_30d', m_new30,
    'new_this_month', m_newmonth,
    -- conversão trial→pago (estimativa): ativos / (ativos + cancelados + inadimplentes)
    'conversion', case when (m_active + m_canceled + m_past) > 0
                       then round(m_active::numeric / (m_active + m_canceled + m_past) * 100, 1) else 0 end,
    -- churn 30d (estimativa): cancelados no mês / (ativos + cancelados no mês)
    'churn_30d', case when (m_active + m_canceled30) > 0
                      then round(m_canceled30::numeric / (m_active + m_canceled30) * 100, 1) else 0 end,
    'series', coalesce(series, '[]'::jsonb)
  );
end;
$$;
