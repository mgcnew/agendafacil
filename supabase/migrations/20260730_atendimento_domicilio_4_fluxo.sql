-- ─────────────────────────────────────────────────────────────────────────
-- Atendimento em domicílio — o fluxo.
--
-- Três peças: agendar informando endereço, avisar a cliente com a promessa
-- CERTA, e a profissional fechar o valor com a quilometragem que ela mediu.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Endereço legível ─────────────────────────────────────────────────────
/**
 * "Rua Gregório Mafra, 26 · Apto 12 — Santo Amaro, São Paulo/SP"
 *
 * Uma linha só, do jeito que se lê pra alguém no telefone. É o que vai na
 * agenda, no WhatsApp e no atalho do Maps — e é cópia congelada no
 * agendamento, porque a cliente pode mudar de casa e o histórico precisa
 * dizer onde a profissional foi DAQUELA vez.
 */
create or replace function public.format_home_address(p jsonb)
 returns text
 language sql
 immutable
as $function$
  select nullif(btrim(
    concat_ws(' — ',
      nullif(concat_ws(' · ',
        nullif(concat_ws(', ',
          nullif(btrim(coalesce(p->>'street', '')), ''),
          nullif(btrim(coalesce(p->>'street_number', '')), '')
        ), ''),
        nullif(btrim(coalesce(p->>'complement', '')), '')
      ), ''),
      nullif(concat_ws(', ',
        nullif(btrim(coalesce(p->>'neighborhood', '')), ''),
        nullif(concat_ws('/',
          nullif(btrim(coalesce(p->>'city', '')), ''),
          nullif(btrim(coalesce(p->>'state', '')), '')
        ), '')
      ), '')
    )
  ), '');
$function$;

-- ── Variáveis novas no render ────────────────────────────────────────────
-- {taxa} e {total} só fazem sentido em domicílio; nos demais tipos ficam
-- vazias, então template antigo que não as cita não muda em nada.
create or replace function public.whatsapp_render(
  p_kind public.whatsapp_message_kind,
  p_appointment_id uuid
) returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_body text;
  r record;
  v_servico text;
  v_insta text;
begin
  select a.salon_id into r from appointments a where a.id = p_appointment_id;

  select t.body into v_body
  from whatsapp_templates t
  where t.kind = p_kind and t.is_active
    and (t.salon_id = r.salon_id or t.salon_id is null)
  order by (t.salon_id is null), random()
  limit 1;

  if v_body is null then return null; end if;

  select
    coalesce(c.full_name, 'tudo bem') as cliente,
    s.name as salao,
    to_char(a.starts_at at time zone s.timezone, 'DD/MM') as data,
    to_char(a.starts_at at time zone s.timezone, 'HH24:MI') as hora,
    instagram_handle(s.instagram) as insta,
    nullif(btrim(coalesce(s.google_business, '')), '') as google,
    coalesce(a.home_address, '') as endereco,
    'R$ ' || trim(to_char(a.travel_fee, 'FM999990.00')) as taxa,
    'R$ ' || trim(to_char(a.total_price, 'FM999990.00')) as total,
    -- A REGRA, pra mensagem que ainda não tem valor fechado.
    'R$ ' || trim(to_char(s.home_first_km_fee, 'FM999990.00')) ||
      ' o primeiro km + R$ ' || trim(to_char(s.home_extra_km_fee, 'FM999990.00')) ||
      ' por km adicional' as regra
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  where a.id = p_appointment_id;

  if r is null then return null; end if;

  if p_kind = 'review_request' and r.google is null then return null; end if;

  select string_agg(aps.name, ' + ' order by aps.name) into v_servico
  from appointment_services aps
  where aps.appointment_id = p_appointment_id;

  v_insta := case
    when r.insta is null then ''
    else E'\n\n📸 A gente posta os trabalhos no Instagram: instagram.com/' || r.insta
  end;

  v_body := replace(v_body, '{cliente}',   split_part(r.cliente, ' ', 1));
  v_body := replace(v_body, '{salao}',     r.salao);
  v_body := replace(v_body, '{data}',      r.data);
  v_body := replace(v_body, '{hora}',      r.hora);
  v_body := replace(v_body, '{servico}',   coalesce(v_servico, 'Atendimento'));
  v_body := replace(v_body, '{instagram}', v_insta);
  v_body := replace(v_body, '{google}',    coalesce(r.google, ''));
  v_body := replace(v_body, '{endereco}',  r.endereco);
  v_body := replace(v_body, '{taxa}',      r.taxa);
  v_body := replace(v_body, '{total}',     r.total);
  v_body := replace(v_body, '{regra}',     r.regra);

  return v_body;
end;
$function$;

-- ── Templates ────────────────────────────────────────────────────────────
-- home_request NÃO diz "está marcado". Diz "recebemos" e promete o valor.
-- A diferença entre essas duas frases é o recurso inteiro.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_request',
   E'Oi, {cliente}! Recebemos seu pedido de atendimento em domicílio no *{salao}* 💚\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\nAinda *não está confirmado*: vamos conferir a agenda e a distância e já te mandamos o valor do deslocamento ({regra}).\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'home_request',
   E'{cliente}, seu pedido chegou! ✨\nAtendimento em domicílio no *{salao}*:\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\nFalta só a gente confirmar. O deslocamento é {regra} — te mando o valor exato daqui a pouco.\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._')
on conflict do nothing;

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_confirmed',
   E'Confirmado, {cliente}! 💚\nVamos até você no dia {data} às {hora}.\n\n📋 {servico}\n📍 {endereco}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nAté lá!\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'home_confirmed',
   E'Oi, {cliente}! Tudo certo pro seu atendimento em casa ✨\n\n📅 {data} às {hora}\n📋 {servico}\n📍 {endereco}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nQualquer coisa é só chamar por aqui!\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._')
on conflict do nothing;

-- ── Teto de 4/semana ─────────────────────────────────────────────────────
-- `home_request` conta: é o comprovante do agendamento, só que em outra
-- roupa. `home_confirmed` NÃO conta: ela só existe respondendo a um pedido
-- que a própria cliente fez, então não dá pra usar pra empurrar volume — e
-- fazer o par consumir metade da cota bloquearia o lembrete da véspera de
-- quem agenda duas vezes na mesma semana.
create or replace function public.whatsapp_kind_iniciada(p_kind public.whatsapp_message_kind)
 returns boolean
 language sql
 immutable
as $function$
  select p_kind in (
    'booking_receipt', 'thank_you', 'reminder_confirm', 'review_request',
    'winback_no_show', 'winback_cancelled', 'winback_inactive',
    'home_request'
  );
$function$;

-- ── Agendar pela página pública ──────────────────────────────────────────
-- drop antes: acrescentar parâmetro com default cria SOBRECARGA, e aí a
-- chamada de 7 argumentos fica ambígua no PostgREST.
drop function if exists public.book_appointment(uuid, uuid, uuid[], timestamptz, text, text, text);
create function public.book_appointment(
  p_salon uuid,
  p_member uuid,
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_notes text default null,
  p_service_mode text default 'salon',
  p_address jsonb default null
) returns appointments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid(); v_total_price numeric(10,2) := 0;
  v_client uuid; v_appt appointments; v_comm numeric(5,2); v_end timestamptz;
  v_span int; v_allow boolean;
  v_on date := (p_starts_at at time zone 'America/Sao_Paulo')::date;
  v_home boolean := (p_service_mode = 'home');
  v_km numeric; v_fee numeric := 0; v_addr text;
begin
  if array_length(p_service_ids, 1) is null then raise exception 'no_services'; end if;

  select coalesce(commission_percent, 0) into v_comm
  from salon_members where id = p_member and salon_id = p_salon and is_active;
  if not found then raise exception 'invalid_member'; end if;

  if not exists (select 1 from services where salon_id = p_salon and is_active and id = any(p_service_ids)) then
    raise exception 'invalid_services';
  end if;

  -- ── Domicílio: só o que o salão realmente oferece ──────────────────────
  if v_home then
    if not exists (select 1 from salons where id = p_salon and home_service_enabled) then
      raise exception 'home_service_off';
    end if;
    -- Um serviço que não sai do salão no meio do pedido invalida o pedido
    -- inteiro. Recusar aqui é melhor que a profissional descobrir na porta.
    if exists (
      select 1 from services
      where salon_id = p_salon and id = any(p_service_ids) and not allows_home_service
    ) then
      raise exception 'service_not_home';
    end if;
    v_addr := format_home_address(p_address);
    if v_addr is null or coalesce(btrim(p_address->>'street_number'), '') = '' then
      raise exception 'home_address_required';
    end if;
  end if;

  select coalesce(sum(effective_price(p_salon, id, price, price_type, v_on)), 0) into v_total_price
  from services where salon_id = p_salon and is_active and id = any(p_service_ids);

  v_span := _appt_total_span(p_salon, p_service_ids);
  v_end := p_starts_at + make_interval(mins => v_span);
  select allow_simultaneous into v_allow from salons where id = p_salon;

  perform _appt_check_conflicts(p_member, p_service_ids, p_starts_at);

  select id into v_client from clients where salon_id = p_salon and phone = p_client_phone;
  if v_client is null then
    insert into clients (salon_id, profile_id, full_name, phone)
    values (p_salon, v_uid, p_client_name, p_client_phone) returning id into v_client;
  else
    update clients set profile_id = coalesce(profile_id, v_uid), full_name = coalesce(full_name, p_client_name)
    where id = v_client;
  end if;

  -- Endereço fica na ficha: da próxima vez ela não digita nada. E se já
  -- houver `distance_km` medido, o valor sai fechado JÁ NESTE agendamento —
  -- é o caso comum, porque quem pede domicílio é cliente que volta.
  if v_home then
    update clients set
      cep = coalesce(nullif(btrim(p_address->>'cep'), ''), cep),
      street = coalesce(nullif(btrim(p_address->>'street'), ''), street),
      street_number = coalesce(nullif(btrim(p_address->>'street_number'), ''), street_number),
      complement = nullif(btrim(coalesce(p_address->>'complement', '')), ''),
      neighborhood = coalesce(nullif(btrim(p_address->>'neighborhood'), ''), neighborhood),
      city = coalesce(nullif(btrim(p_address->>'city'), ''), city),
      state = coalesce(nullif(btrim(p_address->>'state'), ''), state)
    where id = v_client
    returning distance_km into v_km;

    if v_km is not null then
      v_fee := home_service_fee(p_salon, v_km);
      v_total_price := v_total_price + v_fee;
    end if;
  end if;

  if not coalesce(v_allow, false) and client_has_overlap(v_client, p_starts_at, v_end) then
    raise exception 'client_busy';
  end if;

  insert into appointments (
    salon_id, client_id, member_id, status, starts_at, ends_at, total_price,
    notes, source, created_by, service_mode, travel_km, travel_fee, home_address)
  values (
    p_salon, v_client, p_member, 'pending', p_starts_at, v_end, v_total_price,
    p_notes, 'booking_link', v_uid,
    case when v_home then 'home' else 'salon' end, v_km, v_fee, v_addr)
  returning * into v_appt;

  v_end := _appt_fill(p_salon, v_appt.id, p_member, p_service_ids, p_starts_at, v_comm);
  update appointments set ends_at = v_end where id = v_appt.id;
  v_appt.ends_at := v_end;
  return v_appt;
end;
$function$;

-- ── Mensagem certa para cada caso ────────────────────────────────────────
create or replace function public.whatsapp_on_appointment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if TG_OP = 'INSERT' then
    if NEW.status not in ('cancelled', 'no_show', 'completed') then
      -- Domicílio sem quilometragem ainda é PEDIDO, não agendamento. Mandar
      -- "está marcado" aqui seria prometer o que ninguém confirmou.
      if NEW.service_mode = 'home' and NEW.travel_km is null then
        perform whatsapp_enqueue(NEW.id, 'home_request', interval '30 seconds');
      else
        perform whatsapp_enqueue(NEW.id, 'booking_receipt', interval '30 seconds');
      end if;
    end if;

  elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    if NEW.status = 'completed' then
      perform whatsapp_enqueue(NEW.id, 'thank_you', interval '20 minutes');

    elsif NEW.status in ('cancelled', 'no_show') then
      update whatsapp_outbox
      set status = 'skipped', skip_reason = 'agendamento_' || NEW.status, updated_at = now()
      where appointment_id = NEW.id and status = 'queued';
    end if;
  end if;

  return NEW;
exception when others then
  raise warning 'whatsapp_on_appointment falhou (agendamento %): %', NEW.id, sqlerrm;
  return NEW;
end;
$function$;

revoke execute on function public.whatsapp_on_appointment() from public, anon, authenticated;

-- ── A profissional fecha o valor ─────────────────────────────────────────
/**
 * Grava a quilometragem que a profissional mediu, calcula a taxa e avisa a
 * cliente. É o único lugar onde o valor do deslocamento é definido.
 *
 * Guarda o km na ficha da cliente de propósito: é o que faz a PRÓXIMA vez
 * dela ser instantânea, com valor exato já na tela de agendamento. Sem isso o
 * recurso seria trabalhoso pra sempre em vez de trabalhoso uma vez.
 *
 * Idempotente: chamar de novo com outro km desfaz a taxa anterior antes de
 * somar a nova, então corrigir um erro de digitação não infla o total.
 */
create or replace function public.set_appointment_travel(
  p_appointment uuid,
  p_km numeric,
  p_confirm boolean default true
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid; v_client uuid; v_old_fee numeric; v_fee numeric;
  v_status appointment_status; v_avisar boolean;
begin
  select a.salon_id, a.client_id, a.travel_fee, a.status, (a.travel_km is null)
    into v_salon, v_client, v_old_fee, v_status, v_avisar
  from appointments a where a.id = p_appointment;

  if v_salon is null then raise exception 'appointment_not_found'; end if;
  if not has_permission(v_salon, 'appointments.manage') then raise exception 'forbidden'; end if;
  if p_km is null or p_km < 0 then raise exception 'km_invalido'; end if;

  -- Atendimento já cobrado: mexer no total aqui deixaria caixa e agendamento
  -- discordando, e ninguém veria.
  if exists (select 1 from cash_transactions where appointment_id = p_appointment and type = 'income') then
    raise exception 'already_finalized';
  end if;

  v_fee := home_service_fee(v_salon, p_km);

  update appointments set
    service_mode = 'home',
    travel_km = p_km,
    travel_fee = v_fee,
    total_price = greatest(coalesce(total_price, 0) - coalesce(v_old_fee, 0) + v_fee, 0),
    status = case when p_confirm and status = 'pending' then 'confirmed' else status end,
    updated_at = now()
  where id = p_appointment;

  -- O que faz a próxima vez ser instantânea.
  if v_client is not null then
    update clients set distance_km = p_km where id = v_client;
  end if;

  -- Só avisa quando o valor era desconhecido pra cliente. Corrigir o km de um
  -- atendimento já confirmado não deve disparar mensagem nova.
  if v_avisar and p_confirm then
    perform whatsapp_enqueue(p_appointment, 'home_confirmed', interval '10 seconds');
  end if;

  return jsonb_build_object('travel_km', p_km, 'travel_fee', v_fee);
end;
$function$;

revoke execute on function public.set_appointment_travel(uuid, numeric, boolean) from public, anon;
grant execute on function public.set_appointment_travel(uuid, numeric, boolean) to authenticated;
