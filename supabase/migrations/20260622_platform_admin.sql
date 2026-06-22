-- ─────────────────────────────────────────────────────────────────────────
-- Painel da Plataforma (super-admin do SaaS)
-- Cria a noção de admin da plataforma + RPCs SECURITY DEFINER que leem/alteram
-- dados cross-salão APÓS verificar que o chamador é admin. A RLS por salão
-- permanece intacta para todo o resto do app.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Quem é admin da plataforma
create table if not exists platform_admins (
  profile_id uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;

drop policy if exists "admin reads own row" on platform_admins;
create policy "admin reads own row" on platform_admins
  for select using (profile_id = auth.uid());

-- 2. Helper booleano usado por todas as RPCs de admin
create or replace function is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from platform_admins where profile_id = auth.uid());
$$;

-- 3. CADASTRE-SE COMO ADMIN (dono do sistema)
-- Puxa de auth.users (e-mail sempre preenchido); o id é o mesmo de profiles.
insert into platform_admins (profile_id)
select id from auth.users where email = 'mgc.info.new@gmail.com'
on conflict do nothing;

-- 4. KPIs do negócio
create or replace function admin_overview()
returns table (
  total_salons int,
  trialing int,
  active int,
  past_due int,
  canceled int,
  mrr numeric,
  new_30d int
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
  select
    count(*)::int,
    count(*) filter (where s.status = 'trialing')::int,
    count(*) filter (where s.status = 'active')::int,
    count(*) filter (where s.status = 'past_due')::int,
    count(*) filter (where s.status = 'canceled')::int,
    coalesce(sum(case when s.status = 'active' then coalesce(s.value, 0) else 0 end), 0)::numeric,
    (select count(*) from salons sa where sa.created_at >= now() - interval '30 days')::int
  from salon_subscriptions s;
end;
$$;

-- 5. Lista de salões com assinatura e dono
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
  current_period_end timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
  select s.id, s.name, s.slug, s.created_at, s.is_active,
         p.full_name, p.email,
         sub.plan, sub.status, sub.value, sub.trial_ends_at, sub.current_period_end
  from salons s
  left join profiles p on p.id = s.owner_id
  left join salon_subscriptions sub on sub.salon_id = s.id
  order by s.created_at desc;
end;
$$;

-- 6. Ações administrativas
create or replace function admin_extend_trial(p_salon uuid, p_days int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  update salon_subscriptions
     set trial_ends_at = greatest(trial_ends_at, now()) + make_interval(days => p_days),
         status = case when status in ('canceled', 'past_due') then 'trialing' else status end,
         updated_at = now()
   where salon_id = p_salon;
end;
$$;

create or replace function admin_set_plan(p_salon uuid, p_plan text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if p_plan not in ('basic', 'pro', 'max') then raise exception 'invalid plan'; end if;
  update salon_subscriptions set plan = p_plan, updated_at = now() where salon_id = p_salon;
end;
$$;

create or replace function admin_set_status(p_salon uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('trialing', 'active', 'past_due', 'canceled') then raise exception 'invalid status'; end if;
  update salon_subscriptions set status = p_status, updated_at = now() where salon_id = p_salon;
end;
$$;
