-- ─────────────────────────────────────────────────────────────────────────
-- Serviço extra num atendimento já criado (ex.: "veio pro corte, pediu barba
-- também"). Insere a linha em appointment_services e soma o preço em
-- appointments.total_price (não há trigger de recálculo — finalize_appointment
-- lê esse total direto). Comissão e baixa de insumo são recalculadas depois,
-- normalmente, quando o atendimento for finalizado (finalize_appointment já
-- itera todas as linhas de appointment_services).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.add_appointment_service(
  p_appointment uuid,
  p_service_id uuid
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid;
  v_status appointment_status;
  v_name text;
  v_price numeric;
  v_duration numeric;
  v_new_total numeric;
begin
  select a.salon_id, a.status into v_salon, v_status
  from appointments a where a.id = p_appointment;

  if v_salon is null then raise exception 'appointment_not_found'; end if;
  if not is_salon_member(v_salon) then raise exception 'forbidden'; end if;
  if v_status in ('completed', 'cancelled', 'no_show') then
    raise exception 'appointment_closed';
  end if;

  select s.name, s.price, s.duration_min into v_name, v_price, v_duration
  from services s where s.id = p_service_id and s.salon_id = v_salon;

  if v_name is null then raise exception 'service_not_found'; end if;

  insert into appointment_services (salon_id, appointment_id, service_id, name, price, duration_min)
  values (v_salon, p_appointment, p_service_id, v_name, v_price, v_duration);

  update appointments
     set total_price = coalesce(total_price, 0) + v_price,
         updated_at = now()
   where id = p_appointment
   returning total_price into v_new_total;

  return jsonb_build_object('total_price', v_new_total, 'name', v_name, 'price', v_price);
end; $function$;
