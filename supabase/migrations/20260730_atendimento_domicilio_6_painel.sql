-- ─────────────────────────────────────────────────────────────────────────
-- Domicílio pelo painel — a recepcionista atendendo pelo telefone.
--
-- Faltava: o pedido só nascia pela página pública. Mas o caminho mais comum
-- de domicílio é a cliente LIGAR ("dá pra ir na minha casa quinta?"), e sem
-- isto a recepcionista marcava um atendimento normal e o deslocamento sumia.
--
-- Diferença de propósito em relação a `book_appointment`: aqui a pessoa que
-- marca é do salão, então o endereço é opcional quando a cliente JÁ TEM um na
-- ficha (é a de sempre, mesma casa) e o km também já pode estar lá — nesse
-- caso o valor sai fechado na hora, sem nenhum passo extra.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.create_staff_appointment(uuid, uuid, uuid, uuid[], timestamptz, appointment_status, boolean);
create function public.create_staff_appointment(
  p_salon uuid,
  p_member uuid,
  p_client uuid,
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_status appointment_status default 'confirmed',
  p_force boolean default false,
  p_service_mode text default 'salon',
  p_address jsonb default null
) returns appointments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid(); v_comm numeric(5,2); v_total_price numeric(10,2) := 0;
  v_appt appointments; v_end timestamptz; v_span int; v_allow boolean;
  v_on date := (p_starts_at at time zone 'America/Sao_Paulo')::date;
  v_home boolean := (p_service_mode = 'home');
  v_km numeric; v_fee numeric := 0; v_addr text; v_status appointment_status := p_status;
begin
  if not has_permission(p_salon, 'appointments.manage') then raise exception 'forbidden'; end if;
  if array_length(p_service_ids, 1) is null then raise exception 'no_services'; end if;

  select coalesce(commission_percent, 0) into v_comm
  from salon_members where id = p_member and salon_id = p_salon and is_active;
  if not found then raise exception 'invalid_member'; end if;

  if v_home then
    if p_client is null then raise exception 'home_needs_client'; end if;
    if not exists (select 1 from salons where id = p_salon and home_service_enabled) then
      raise exception 'home_service_off';
    end if;
    if exists (
      select 1 from services
      where salon_id = p_salon and id = any(p_service_ids) and not allows_home_service
    ) then
      raise exception 'service_not_home';
    end if;

    -- Endereço novo grava na ficha; sem endereço novo, usa o que já está lá.
    if p_address is not null and coalesce(btrim(p_address->>'street_number'), '') <> '' then
      update clients set
        cep = coalesce(nullif(btrim(p_address->>'cep'), ''), cep),
        street = coalesce(nullif(btrim(p_address->>'street'), ''), street),
        street_number = coalesce(nullif(btrim(p_address->>'street_number'), ''), street_number),
        complement = nullif(btrim(coalesce(p_address->>'complement', '')), ''),
        neighborhood = coalesce(nullif(btrim(p_address->>'neighborhood'), ''), neighborhood),
        city = coalesce(nullif(btrim(p_address->>'city'), ''), city),
        state = coalesce(nullif(btrim(p_address->>'state'), ''), state)
      where id = p_client;
    end if;

    select
      format_home_address(jsonb_build_object(
        'street', c.street, 'street_number', c.street_number, 'complement', c.complement,
        'neighborhood', c.neighborhood, 'city', c.city, 'state', c.state)),
      c.distance_km
    into v_addr, v_km
    from clients c where c.id = p_client;

    if v_addr is null then raise exception 'home_address_required'; end if;

    if v_km is not null then
      v_fee := home_service_fee(p_salon, v_km);
    else
      -- Sem quilometragem o valor ainda não existe. Nasce 'pending' pra cair
      -- na mesma fila de "pedidos à espera de km" da página pública, em vez
      -- de virar um confirmado com deslocamento zerado que ninguém percebe.
      v_status := 'pending';
    end if;
  end if;

  select coalesce(sum(effective_price(p_salon, id, price, price_type, v_on)), 0) into v_total_price
  from services where salon_id = p_salon and id = any(p_service_ids);
  v_total_price := v_total_price + v_fee;

  v_span := _appt_total_span(p_salon, p_service_ids);
  v_end := p_starts_at + make_interval(mins => v_span);
  select allow_simultaneous into v_allow from salons where id = p_salon;

  if not p_force then
    perform _appt_check_conflicts(p_member, p_service_ids, p_starts_at);
    if p_client is not null and not coalesce(v_allow, false)
       and client_has_overlap(p_client, p_starts_at, v_end) then
      raise exception 'client_busy';
    end if;
  end if;

  insert into appointments (
    salon_id, client_id, member_id, status, starts_at, ends_at, total_price,
    source, created_by, service_mode, travel_km, travel_fee, home_address)
  values (
    p_salon, p_client, p_member, v_status, p_starts_at, v_end, v_total_price,
    'panel', v_uid,
    case when v_home then 'home' else 'salon' end, v_km, v_fee, v_addr)
  returning * into v_appt;

  v_end := _appt_fill(p_salon, v_appt.id, p_member, p_service_ids, p_starts_at, v_comm);
  update appointments set ends_at = v_end where id = v_appt.id;
  v_appt.ends_at := v_end;
  return v_appt;
end;
$function$;

revoke execute on function public.create_staff_appointment(uuid, uuid, uuid, uuid[], timestamptz, appointment_status, boolean, text, jsonb) from public, anon;
grant execute on function public.create_staff_appointment(uuid, uuid, uuid, uuid[], timestamptz, appointment_status, boolean, text, jsonb) to authenticated;

-- ── Endereço e km da cliente, para a tela de agendamento do painel ───────
/**
 * A recepcionista precisa saber, ao marcar, se já existe endereço e km desta
 * cliente — é o que decide entre "sai com valor fechado" e "vira pedido".
 * `public_home_address` resolve isso pra página pública; aqui a leitura direta
 * da tabela já basta, porque a RLS de `clients` cobre a equipe do salão.
 */
comment on column public.clients.distance_km is
  'Distância do salão até a casa da cliente, em km, medida uma vez pela profissional no Maps. Reaproveitada em todo atendimento em domicílio seguinte.';
