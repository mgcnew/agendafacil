-- ─────────────────────────────────────────────────────────────────────────
-- Telefone que nunca recebe mensagem — e ninguém percebe.
--
-- 3 dos 12 clientes reais estavam com telefone inutilizável (um deles é
-- literalmente '+55', só o código do país). Esses clientes não recebem NADA:
-- nem comprovante, nem lembrete, nem agradecimento, nem recuperação. E não há
-- sinal em lugar nenhum — a fila descarta antes de enfileirar, então nem a
-- tela de "Últimas mensagens" mostra, porque a mensagem nunca chegou a existir.
--
-- A origem estava no `toE164` da página pública:
--
--   function toE164(raw) { return "+55" + raw.replace(/\D/g, ""); }
--
-- Campo vazio virava "+55". "abc" virava "+55". Número pela metade virava um
-- telefone com cara de válido. E o botão só exigia campo não-vazio.
--
-- Duas correções aqui, uma em cada camada:
--
-- 1. CONSTRAINT: lixo não entra mais. `not valid` de propósito — as 3 linhas
--    existentes ficam como estão (vão ser corrigidas à mão) e só o que for
--    gravado daqui pra frente é conferido. Sem isso a migration falharia, ou
--    pior: eu teria que "consertar" telefone alheio adivinhando.
--
--    NULL continua permitido: cliente que passou no balcão e não quis deixar
--    telefone é caso legítimo. O que não pode existir é telefone que PARECE
--    telefone e não é.
--
-- 2. book_appointment casando por telefone NORMALIZADO. Este é um bug vizinho
--    que apareceu na investigação: o painel grava "11992000007" e a página
--    pública grava "+5511992000007". Com `=` exato, a MESMA pessoa virava dois
--    cadastros — e o histórico dela se partia em dois, o que estraga
--    aniversário, recuperação de cliente e a contagem de "já veio 2 vezes" do
--    pedido de avaliação. O índice pra isso já existia
--    (clients_phone_normalized_idx), só não estava sendo usado aqui.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.clients drop constraint if exists clients_phone_valido;
alter table public.clients add constraint clients_phone_valido
  check (phone is null or normalize_br_phone(phone) is not null)
  not valid;

-- ── Um telefone, um cadastro ─────────────────────────────────────────────
create or replace function public.book_appointment(
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
  v_fone text := normalize_br_phone(p_client_phone);
begin
  if array_length(p_service_ids, 1) is null then raise exception 'no_services'; end if;
  -- Sem telefone utilizável não dá pra confirmar nada com essa pessoa depois.
  -- Recusar aqui é melhor que criar um cadastro mudo.
  if v_fone is null then raise exception 'telefone_invalido'; end if;

  select coalesce(commission_percent, 0) into v_comm
  from salon_members where id = p_member and salon_id = p_salon and is_active;
  if not found then raise exception 'invalid_member'; end if;

  if not exists (select 1 from services where salon_id = p_salon and is_active and id = any(p_service_ids)) then
    raise exception 'invalid_services';
  end if;

  if v_home then
    if not exists (select 1 from salons where id = p_salon and home_service_enabled) then
      raise exception 'home_service_off';
    end if;
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

  -- Casa por telefone normalizado: "11992000007" (painel) e "+5511992000007"
  -- (página pública) são a mesma pessoa. Usa clients_phone_normalized_idx.
  select id into v_client from clients
  where salon_id = p_salon and normalize_br_phone(phone) = v_fone
  limit 1;

  if v_client is null then
    insert into clients (salon_id, profile_id, full_name, phone)
    values (p_salon, v_uid, p_client_name, '+' || v_fone) returning id into v_client;
  else
    update clients set profile_id = coalesce(profile_id, v_uid), full_name = coalesce(full_name, p_client_name)
    where id = v_client;
  end if;

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
