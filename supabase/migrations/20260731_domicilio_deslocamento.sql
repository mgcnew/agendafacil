-- ─────────────────────────────────────────────────────────────────────────
-- O tempo de ir e voltar.
--
-- Um atendimento em domicílio não ocupa a profissional das 14h às 15h. Ocupa
-- de "sair do salão" até "voltar ao salão". A agenda só sabia a janela do
-- serviço, então aceitava alguém às 15h05 e o dia ficava fisicamente
-- impossível — e ninguém descobria antes do dia.
--
-- POR QUE A PROFISSIONAL INFORMA, EM VEZ DE O SISTEMA CALCULAR: pensei em
-- derivar do km, e está errado. Ir a 10 km às 10h e às 17h em São Paulo são
-- viagens diferentes, e a estimativa erraria justo quando dói. Ela já vai
-- abrir o Maps pra pegar a distância — a MESMA tela mostra o tempo. Não é
-- dado novo nem trabalho novo: são dois números da mesma viagem.
--
-- Dois lados, não um: bloqueia a ida antes e a volta depois.
--
-- O BLOQUEIO MORRE JUNTO COM O AGENDAMENTO. É a parte que apodrece devagar:
-- a cliente cancela, o agendamento some, e o buraco de 50 minutos fica na
-- agenda pra sempre. Em três meses a agenda está cheia de furos fantasma e
-- ninguém liga uma coisa na outra. Daí o `appointment_id` com cascata e a
-- limpeza no cancelamento.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.schedule_blocks
  add column if not exists appointment_id uuid references public.appointments(id) on delete cascade;

create index if not exists schedule_blocks_appointment_idx
  on public.schedule_blocks (appointment_id) where appointment_id is not null;

-- Guardado pra que corrigir o km depois não apague o tempo já informado.
alter table public.appointments
  add column if not exists travel_minutes integer;

alter table public.appointments drop constraint if exists appointments_travel_minutes_check;
alter table public.appointments add constraint appointments_travel_minutes_check
  check (travel_minutes is null or (travel_minutes >= 0 and travel_minutes <= 480));

-- ── Quem esbarra na ida ou na volta ──────────────────────────────────────
/**
 * Agendamentos da mesma profissional que caem dentro da janela de
 * deslocamento. Serve pra avisar ANTES de confirmar — que é o único momento
 * em que ainda dá pra propor outro horário à cliente.
 *
 * O próprio atendimento fica de fora, claro. Cancelado e falta também: não
 * ocupam ninguém.
 */
create or replace function public.home_travel_conflicts(
  p_appointment uuid,
  p_minutes integer
) returns table (id uuid, client_name text, starts_at timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select o.id, coalesce(c.full_name, 'Cliente'), o.starts_at
  from appointments a
  join appointments o
    on o.member_id = a.member_id
   and o.salon_id = a.salon_id
   and o.id <> a.id
   and o.status not in ('cancelled', 'no_show')
   and o.starts_at < a.ends_at + make_interval(mins => coalesce(p_minutes, 0))
   and o.ends_at   > a.starts_at - make_interval(mins => coalesce(p_minutes, 0))
  left join clients c on c.id = o.client_id
  where a.id = p_appointment
    and is_salon_member(a.salon_id)
  order by o.starts_at;
$function$;

revoke execute on function public.home_travel_conflicts(uuid, integer) from public, anon;
grant execute on function public.home_travel_conflicts(uuid, integer) to authenticated;

-- ── Fechar o valor e reservar o trajeto ──────────────────────────────────
-- Drop antes: acrescentar parâmetro cria SOBRECARGA, não substituição. Com as
-- duas assinaturas no ar, a chamada de 3 argumentos que o painel já fazia
-- viraria "function is not unique".
drop function if exists public.set_appointment_travel(uuid, numeric, boolean);
create or replace function public.set_appointment_travel(
  p_appointment uuid,
  p_km numeric,
  p_confirm boolean default true,
  p_minutes integer default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid; v_client uuid; v_member uuid; v_old_fee numeric; v_fee numeric;
  v_avisar boolean; v_starts timestamptz; v_ends timestamptz; v_nome text;
begin
  select a.salon_id, a.client_id, a.member_id, a.travel_fee, (a.travel_km is null),
         a.starts_at, a.ends_at, coalesce(c.full_name, 'Cliente')
    into v_salon, v_client, v_member, v_old_fee, v_avisar, v_starts, v_ends, v_nome
  from appointments a
  left join clients c on c.id = a.client_id
  where a.id = p_appointment;

  if v_salon is null then raise exception 'appointment_not_found'; end if;
  if not has_permission(v_salon, 'appointments.manage') then raise exception 'forbidden'; end if;
  if p_km is null or p_km < 0 then raise exception 'km_invalido'; end if;
  if p_minutes is not null and (p_minutes < 0 or p_minutes > 480) then
    raise exception 'minutos_invalidos';
  end if;

  if exists (select 1 from cash_transactions where appointment_id = p_appointment and type = 'income') then
    raise exception 'already_finalized';
  end if;

  v_fee := home_service_fee(v_salon, p_km);

  update appointments set
    service_mode = 'home',
    travel_km = p_km,
    travel_fee = v_fee,
    travel_minutes = coalesce(p_minutes, travel_minutes),
    total_price = greatest(coalesce(total_price, 0) - coalesce(v_old_fee, 0) + v_fee, 0),
    status = case when p_confirm and status = 'pending' then 'confirmed' else status end,
    updated_at = now()
  where id = p_appointment;

  if v_client is not null then
    update clients set distance_km = p_km where id = v_client;
  end if;

  -- Refaz do zero: corrigir de 30 pra 20 minutos precisa ENCOLHER o bloqueio,
  -- não acrescentar um segundo por cima do primeiro.
  delete from schedule_blocks where appointment_id = p_appointment;

  if coalesce(p_minutes, 0) > 0 then
    insert into schedule_blocks (salon_id, member_id, starts_at, ends_at, reason, appointment_id)
    values
      (v_salon, v_member, v_starts - make_interval(mins => p_minutes), v_starts,
       'Ida — ' || v_nome, p_appointment),
      (v_salon, v_member, v_ends, v_ends + make_interval(mins => p_minutes),
       'Volta — ' || v_nome, p_appointment);
  end if;

  if v_avisar and p_confirm then
    perform whatsapp_enqueue(p_appointment, 'home_confirmed', interval '10 seconds');
  end if;

  return jsonb_build_object('travel_km', p_km, 'travel_fee', v_fee, 'travel_minutes', p_minutes);
end;
$function$;

revoke execute on function public.set_appointment_travel(uuid, numeric, boolean, integer) from public, anon;
grant execute on function public.set_appointment_travel(uuid, numeric, boolean, integer) to authenticated;

-- ── Cancelou: o trajeto some junto ───────────────────────────────────────
/**
 * Trigger própria em vez de pendurar na `whatsapp_on_appointment`: aquela
 * engole exceção de propósito (mensagem não pode derrubar agendamento), e
 * limpeza de agenda engolida em silêncio é justamente como o furo fantasma
 * apareceria de novo.
 *
 * O `on delete cascade` cobre exclusão; isto cobre a mudança de status, que é
 * o caminho comum — cancelar não apaga a linha.
 */
create or replace function public.appointments_clear_travel_blocks()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if NEW.status in ('cancelled', 'no_show') then
    delete from schedule_blocks where appointment_id = NEW.id;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists appointments_travel_blocks on public.appointments;
create trigger appointments_travel_blocks
  after update of status on public.appointments
  for each row execute function public.appointments_clear_travel_blocks();

revoke execute on function public.appointments_clear_travel_blocks() from public, anon, authenticated;
