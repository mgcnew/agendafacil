-- Chave do aparelho no lugar do telefone para o que é da cliente na página
-- pública (/{slug}).
--
-- Antes, as funções públicas confiavam só no número de celular: quem
-- soubesse (ou chutasse) o celular de uma cliente via o histórico dela no
-- salão, cancelava os agendamentos, lia o endereço salvo e gravava por cima
-- da ficha de saúde. Celular não é segredo.
--
-- Agora o navegador cria uma chave aleatória (fica no localStorage) e a
-- "reivindica" logo depois de agendar ou entrar na lista de espera. Cada
-- aparelho vê e mexe só no que foi feito nele. A chave é por AGENDAMENTO, não
-- por cliente: se valesse para o cadastro inteiro, bastaria agendar com o
-- celular de outra pessoa para ganhar acesso ao histórico dela.
--
-- Quem está logada continua pelo auth.uid(), como antes.
--
-- As funções existentes mantêm a assinatura (o parâmetro segue chamado
-- p_phone para não quebrar quem já chama) — mas o valor agora é a chave do
-- aparelho, não o telefone. Telefone ali não abre mais nada.

create or replace function public.device_token_hash(p text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $$
  -- Chave curta demais não vale: impede adivinhar por força bruta.
  select case when p is null or length(p) < 32 then null
              else encode(extensions.digest(p, 'sha256'), 'hex') end;
$$;
revoke all on function public.device_token_hash(text) from public, anon, authenticated;

alter table public.appointments add column if not exists device_token_hash text;
alter table public.appointment_waitlist add column if not exists device_token_hash text;
create index if not exists appointments_device_token_idx
  on public.appointments (salon_id, device_token_hash) where device_token_hash is not null;
create index if not exists waitlist_device_token_idx
  on public.appointment_waitlist (salon_id, device_token_hash) where device_token_hash is not null;

-- Liga um agendamento recém-criado à chave deste aparelho. Só uma vez, só
-- nos primeiros 15 minutos, e só com o id (um uuid que só quem agendou tem).
create or replace function public.public_claim_appointment(p_appointment uuid, p_token text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_hash text := device_token_hash(p_token);
begin
  if v_hash is null then return false; end if;
  update appointments
     set device_token_hash = v_hash
   where id = p_appointment
     and device_token_hash is null
     and created_at > now() - interval '15 minutes';
  return found;
end;
$$;

create or replace function public.public_claim_waitlist(p_id uuid, p_token text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_hash text := device_token_hash(p_token);
begin
  if v_hash is null then return false; end if;
  update appointment_waitlist
     set device_token_hash = v_hash
   where id = p_id
     and device_token_hash is null
     and created_at > now() - interval '15 minutes';
  return found;
end;
$$;
grant execute on function public.public_claim_appointment(uuid, text) to anon, authenticated;
grant execute on function public.public_claim_waitlist(uuid, text) to anon, authenticated;

-- "Meus agendamentos": o que este aparelho agendou (ou a conta logada).
create or replace function public.public_my_appointments(p_salon uuid, p_phone text default null)
 returns table(id uuid, salon_id uuid, salon_name text, member_id uuid, member_name text, status appointment_status, starts_at timestamp with time zone, ends_at timestamp with time zone, total_price numeric, services text[])
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.salon_id, sl.name as salon_name,
    a.member_id,
    coalesce(sm.display_name, pr.full_name) as member_name,
    a.status, a.starts_at, a.ends_at, a.total_price,
    array(select name from appointment_services where appointment_id = a.id) as services
  from appointments a
  join salons sl on sl.id = a.salon_id
  join salon_members sm on sm.id = a.member_id
  join profiles pr on pr.id = sm.profile_id
  join clients c on c.id = a.client_id
  where a.salon_id = p_salon
    and (
      (auth.uid() is not null and c.profile_id = auth.uid())
      or (device_token_hash(p_phone) is not null and a.device_token_hash = device_token_hash(p_phone))
    )
  order by a.starts_at desc;
$function$;

create or replace function public.public_my_waitlist(p_salon uuid, p_phone text default null)
 returns table(id uuid, preferred_date date, status text, created_at timestamp with time zone, member_name text, services text[])
 language sql
 stable security definer
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
      or (device_token_hash(p_phone) is not null and w.device_token_hash = device_token_hash(p_phone))
    )
  order by w.created_at desc;
$function$;

-- Endereço salvo para atendimento em casa: só o da cliente que este aparelho
-- já atendeu (ou da conta logada). Antes saía de qualquer telefone digitado.
create or replace function public.public_home_address(p_salon uuid, p_phone text)
 returns table(cep text, street text, street_number text, complement text, neighborhood text, city text, state text, distance_km numeric, fee numeric)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.cep, c.street, c.street_number, c.complement,
         c.neighborhood, c.city, c.state, c.distance_km,
         home_service_fee(p_salon, c.distance_km)
  from clients c
  where c.salon_id = p_salon
    and c.id = coalesce(
      (select a.client_id from appointments a
        where a.salon_id = p_salon
          and device_token_hash(p_phone) is not null
          and a.device_token_hash = device_token_hash(p_phone)
        order by a.created_at desc limit 1),
      (select c2.id from clients c2
        where c2.salon_id = p_salon and auth.uid() is not null and c2.profile_id = auth.uid()
        limit 1)
    )
  limit 1;
$function$;

-- As demais trocam só a checagem do telefone pela da chave, na definição viva
-- (algumas já divergiram dos arquivos de migração antigos).
do $$
declare
  antigo constant text := '(p_phone is not null and v_phone is not null and v_phone = p_phone)';
  f record;
  d text;
begin
  for f in
    select * from (values
      ('public.public_cancel_appointment(uuid,text)',
       '(device_token_hash(p_phone) is not null and exists (select 1 from appointments a2 where a2.id = p_appointment and a2.device_token_hash = device_token_hash(p_phone)))'),
      ('public.public_cancel_waitlist(uuid,text)',
       '(device_token_hash(p_phone) is not null and exists (select 1 from appointment_waitlist w2 where w2.id = p_id and w2.device_token_hash = device_token_hash(p_phone)))'),
      ('public.public_set_appointment_inspiration(uuid,uuid[],text)',
       '(device_token_hash(p_phone) is not null and exists (select 1 from appointments a2 where a2.id = p_appointment and a2.device_token_hash = device_token_hash(p_phone)))'),
      ('public.public_needs_anamnesis(uuid,text)',
       '(device_token_hash(p_phone) is not null and exists (select 1 from appointments a2 where a2.client_id = p_client_id and a2.device_token_hash = device_token_hash(p_phone)))')
    ) as x(sig, novo)
  loop
    d := pg_get_functiondef(f.sig::regprocedure);
    if position(antigo in d) = 0 then
      raise exception '%: checagem por telefone não encontrada; nada foi alterado', f.sig;
    end if;
    execute replace(d, antigo, f.novo);
  end loop;

  d := pg_get_functiondef('public.public_save_anamnesis'::regproc);
  if position(antigo in d) = 0 then
    raise exception 'public_save_anamnesis: checagem por telefone não encontrada; nada foi alterado';
  end if;
  execute replace(d, antigo,
    '(device_token_hash(p_phone) is not null and exists (select 1 from appointments a2 where a2.client_id = p_client_id and a2.device_token_hash = device_token_hash(p_phone)))');
end $$;

-- Sem uso no app e aberta a qualquer um: agendamentos de um telefone.
revoke execute on function public.public_appointments_by_phone(uuid, text) from public, anon, authenticated;
