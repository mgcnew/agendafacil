-- ─────────────────────────────────────────────────────────────────────────
-- MRR histórico exato: snapshot diário das assinaturas via pg_cron.
-- Enquanto não houver histórico suficiente, o painel cai na estimativa.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists mrr_snapshots (
  snapshot_date date primary key,
  mrr       numeric not null default 0,
  active    int     not null default 0,
  trialing  int     not null default 0,
  past_due  int     not null default 0,
  canceled  int     not null default 0,
  total     int     not null default 0
);
alter table mrr_snapshots enable row level security;

-- Captura/atualiza o snapshot de hoje.
create or replace function capture_mrr_snapshot()
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into mrr_snapshots (snapshot_date, mrr, active, trialing, past_due, canceled, total)
  select current_date,
    coalesce(sum(value) filter (where status = 'active'), 0),
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'trialing'),
    count(*) filter (where status = 'past_due'),
    count(*) filter (where status = 'canceled'),
    count(*)
  from salon_subscriptions
  on conflict (snapshot_date) do update set
    mrr = excluded.mrr, active = excluded.active, trialing = excluded.trialing,
    past_due = excluded.past_due, canceled = excluded.canceled, total = excluded.total;
end;
$$;

-- Histórico mensal (último snapshot de cada mês, últimos 12 meses) para o admin.
create or replace function admin_mrr_history()
returns table (month text, mrr numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
  select distinct on (date_trunc('month', s.snapshot_date))
         to_char(s.snapshot_date, 'YYYY-MM'), s.mrr
  from mrr_snapshots s
  where s.snapshot_date >= date_trunc('month', now()) - interval '11 months'
  order by date_trunc('month', s.snapshot_date), s.snapshot_date desc;
end;
$$;

-- Backfill do dia de hoje (1º ponto).
select capture_mrr_snapshot();

-- Agenda diária (03:05 UTC ≈ 00:05 BRT). Requer a extensão pg_cron habilitada
-- (Supabase: Database → Extensions → pg_cron). Se a linha abaixo falhar,
-- habilite a extensão e rode só ela de novo.
create extension if not exists pg_cron;
select cron.schedule('mrr-daily-snapshot', '5 3 * * *', $$select capture_mrr_snapshot();$$);
