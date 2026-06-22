-- ─────────────────────────────────────────────────────────────────────────
-- Avisos globais: o admin publica um comunicado que aparece no painel de
-- todos os salões. Leitura liberada a usuários autenticados (só ativos);
-- escrita só via RPCs SECURITY DEFINER que checam is_platform_admin().
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists platform_announcements (
  id         uuid        primary key default gen_random_uuid(),
  message    text        not null,
  kind       text        not null default 'info' check (kind in ('info', 'warning', 'success')),
  link_url   text,
  link_label text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  created_by uuid        references profiles(id)
);
alter table platform_announcements enable row level security;

drop policy if exists "authenticated reads active announcements" on platform_announcements;
create policy "authenticated reads active announcements" on platform_announcements
  for select to authenticated using (is_active = true);

create or replace function admin_list_announcements()
returns setof platform_announcements
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query select * from platform_announcements order by created_at desc;
end;
$$;

create or replace function admin_create_announcement(
  p_message text, p_kind text, p_link_url text, p_link_label text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'mensagem vazia'; end if;
  insert into platform_announcements (message, kind, link_url, link_label, created_by)
  values (
    trim(p_message),
    coalesce(nullif(p_kind, ''), 'info'),
    nullif(trim(coalesce(p_link_url, '')), ''),
    nullif(trim(coalesce(p_link_label, '')), ''),
    auth.uid()
  );
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'create_announcement', jsonb_build_object('message', left(trim(p_message), 80)));
end;
$$;

create or replace function admin_set_announcement_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  update platform_announcements set is_active = p_active where id = p_id;
end;
$$;

create or replace function admin_delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  delete from platform_announcements where id = p_id;
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'delete_announcement', jsonb_build_object('id', p_id));
end;
$$;
