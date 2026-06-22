-- ─────────────────────────────────────────────────────────────────────────
-- Bloco 4: gestão de admins pela tela + log de auditoria das ações do painel.
-- ─────────────────────────────────────────────────────────────────────────

-- Log de auditoria (acessível só via RPC SECURITY DEFINER)
create table if not exists admin_audit_log (
  id         uuid        primary key default gen_random_uuid(),
  actor      uuid        references profiles(id),
  action     text        not null,
  salon_id   uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
alter table admin_audit_log enable row level security;

-- Gestão de admins
create or replace function admin_list_admins()
returns table (profile_id uuid, email text, full_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
  select pa.profile_id, p.email, p.full_name, pa.created_at
  from platform_admins pa
  left join profiles p on p.id = pa.profile_id
  order by pa.created_at;
end;
$$;

create or replace function admin_add_admin(p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'Usuário não encontrado (precisa ter conta no app).'; end if;
  insert into platform_admins (profile_id) values (v_id) on conflict do nothing;
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'add_admin', jsonb_build_object('email', p_email));
end;
$$;

create or replace function admin_remove_admin(p_profile uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if p_profile = auth.uid() then raise exception 'Você não pode remover a si mesmo.'; end if;
  delete from platform_admins where profile_id = p_profile;
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'remove_admin', jsonb_build_object('profile_id', p_profile));
end;
$$;

-- Leitura do log
create or replace function admin_audit(p_limit int default 50)
returns table (id uuid, actor_email text, action text, salon_name text, detail jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
  select l.id, p.email, l.action, s.name, l.detail, l.created_at
  from admin_audit_log l
  left join profiles p on p.id = l.actor
  left join salons s on s.id = l.salon_id
  order by l.created_at desc
  limit coalesce(p_limit, 50);
end;
$$;

-- Ações existentes agora gravam no log de auditoria
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
  insert into admin_audit_log (actor, action, salon_id, detail)
    values (auth.uid(), 'extend_trial', p_salon, jsonb_build_object('days', p_days));
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
  insert into admin_audit_log (actor, action, salon_id, detail)
    values (auth.uid(), 'set_plan', p_salon, jsonb_build_object('plan', p_plan));
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
  insert into admin_audit_log (actor, action, salon_id, detail)
    values (auth.uid(), 'set_status', p_salon, jsonb_build_object('status', p_status));
end;
$$;
