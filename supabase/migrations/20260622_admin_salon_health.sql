-- ─────────────────────────────────────────────────────────────────────────
-- Saúde dos salões (anti-churn): adiciona métricas de uso à listagem do admin.
-- Recria admin_list_salons com colunas extras (precisa DROP por mudar o retorno).
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists admin_list_salons();

create or replace function admin_list_salons()
returns table (
  salon_id uuid,
  name text,
  slug text,
  created_at timestamptz,
  is_active boolean,
  owner_name text,
  owner_email text,
  plan text,
  status text,
  value numeric,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  appts_30d int,
  clients_count int,
  members_count int,
  last_activity timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
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
  order by s.created_at desc;
end;
$$;
