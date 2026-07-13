-- ─────────────────────────────────────────────────────────────────────────
-- Lista de espera: cliente que quer um dia/horário sem vaga se coloca na
-- fila; a equipe vê no painel (Agenda) e liga/chama pra encaixar se abrir
-- horário. Sem canal automático pra cliente ainda (não existe push/SMS pro
-- público hoje) — quem avisa é a dona, manualmente. Fica registrado pra v2.
--
-- Por dia (não por horário exato): a cliente pede "algum horário nesse dia",
-- não um slot específico — mais fácil de casar com cancelamentos.
-- ─────────────────────────────────────────────────────────────────────────

create table public.appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  member_id uuid references public.salon_members(id) on delete set null, -- null = qualquer profissional
  service_ids uuid[] not null default '{}',
  preferred_date date not null,
  notes text,
  status text not null default 'waiting' check (status in ('waiting', 'converted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index appointment_waitlist_salon_date_idx
  on public.appointment_waitlist (salon_id, preferred_date)
  where status = 'waiting';

alter table public.appointment_waitlist enable row level security;

-- Equipe do salão vê e gerencia (converter em agendamento = editar direto
-- pelo painel; remover = delete). Mesma checagem usada em push_subscriptions.
create policy "members manage salon waitlist"
  on public.appointment_waitlist
  for all
  using (is_salon_member(salon_id))
  with check (is_salon_member(salon_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Cliente entra na lista de espera (link público). Resolve o client_id do
-- mesmo jeito que public_cancel_appointment/public_my_appointments: logada
-- (profile_id = auth.uid()) ou por telefone; cria o cliente se for a
-- primeira vez (mesmo caso do book_appointment pra cliente nova).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.public_join_waitlist(
  p_salon uuid,
  p_client_name text,
  p_client_phone text,
  p_service_ids uuid[],
  p_date date,
  p_member uuid default null,
  p_notes text default null
)
 returns appointment_waitlist
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_client_id uuid;
  v_row appointment_waitlist;
begin
  if auth.uid() is not null then
    select id into v_client_id from clients where salon_id = p_salon and profile_id = auth.uid();
  end if;

  if v_client_id is null and p_client_phone is not null then
    select id into v_client_id from clients where salon_id = p_salon and phone = p_client_phone;
  end if;

  if v_client_id is null then
    insert into clients (salon_id, full_name, phone, profile_id)
    values (p_salon, coalesce(nullif(p_client_name, ''), 'Cliente'), p_client_phone, auth.uid())
    returning id into v_client_id;
  end if;

  insert into appointment_waitlist (salon_id, client_id, member_id, service_ids, preferred_date, notes)
  values (p_salon, v_client_id, p_member, p_service_ids, p_date, p_notes)
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.public_join_waitlist(uuid, text, text, uuid[], date, uuid, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Cliente vê suas entradas na lista de espera ("Meus agendamentos" → aba
-- Espera). Mesma autorização (logada ou telefone) de public_my_appointments.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.public_my_waitlist(
  p_salon uuid,
  p_phone text default null
)
 returns table (
   id uuid,
   preferred_date date,
   status text,
   created_at timestamptz,
   member_name text,
   services text[]
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select w.id, w.preferred_date, w.status, w.created_at,
    coalesce(sm.display_name, pr.full_name) as member_name,
    array(select s.name from services s where s.id = any(w.service_ids)) as services
  from appointment_waitlist w
  join clients c on c.id = w.client_id
  left join salon_members sm on sm.id = w.member_id
  left join profiles pr on pr.id = sm.profile_id
  where w.salon_id = p_salon
    and (
      (auth.uid() is not null and c.profile_id = auth.uid())
      or (p_phone is not null and c.phone = p_phone)
    )
  order by w.created_at desc;
$function$;

grant execute on function public.public_my_waitlist(uuid, text) to anon, authenticated;

-- Cliente desiste da lista de espera.
create or replace function public.public_cancel_waitlist(
  p_id uuid,
  p_phone text default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_phone text;
  v_profile uuid;
begin
  select c.phone, c.profile_id into v_phone, v_profile
  from appointment_waitlist w join clients c on c.id = w.client_id
  where w.id = p_id;

  if not found then raise exception 'not_found'; end if;

  if not (
       (v_profile is not null and v_profile = auth.uid())
    or (p_phone is not null and v_phone is not null and v_phone = p_phone)
  ) then
    raise exception 'forbidden';
  end if;

  update appointment_waitlist set status = 'cancelled' where id = p_id;
end;
$function$;

grant execute on function public.public_cancel_waitlist(uuid, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Quando um agendamento é cancelado, avisa a equipe (sino/push já disparava
-- pro evento "cancelled") quantas pessoas estão esperando aquele dia — pra
-- dona saber que pode ligar oferecendo o horário que abriu.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_appointment_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event text;
  v_secret text;
  v_client text;
  v_waiting int;
begin
  if TG_OP = 'INSERT' then
    if NEW.status in ('cancelled', 'no_show', 'completed') then return NEW; end if;
    v_event := 'created';
  elsif TG_OP = 'UPDATE' and OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    v_event := 'cancelled';
  else
    return NEW;
  end if;

  select c.full_name into v_client from clients c where c.id = NEW.client_id;

  if v_event = 'cancelled' then
    select count(*) into v_waiting
    from appointment_waitlist w
    where w.salon_id = NEW.salon_id
      and w.status = 'waiting'
      and w.preferred_date = (NEW.starts_at at time zone 'America/Sao_Paulo')::date
      and (w.member_id is null or w.member_id = NEW.member_id);
  end if;

  insert into notifications (salon_id, recipient_id, type, title, body, data)
  select NEW.salon_id, m.profile_id,
         'appointment_' || v_event,
         case when v_event = 'created' then 'Novo agendamento' else 'Agendamento cancelado' end,
         coalesce(v_client, 'Cliente') || ' · ' ||
           to_char(NEW.starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') ||
           case when v_event = 'cancelled' and coalesce(v_waiting, 0) > 0
                then ' · ' || v_waiting || ' na lista de espera' else '' end,
         jsonb_build_object('appointment_id', NEW.id, 'event', v_event, 'starts_at', NEW.starts_at)
  from salon_members m
  where m.salon_id = NEW.salon_id and m.is_active and m.profile_id is not null;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';

  if v_secret is not null then
    perform net.http_post(
      url := 'https://lllibsgqpvgmpurzmram.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      body := jsonb_build_object('event', v_event, 'appointment_id', NEW.id, 'salon_id', NEW.salon_id)
    );
  end if;

  return NEW;
end;
$function$;

revoke execute on function public.notify_appointment_event() from anon, authenticated;
