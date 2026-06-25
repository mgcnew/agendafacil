-- ─────────────────────────────────────────────────────────────────────────
-- Cancelamento de agendamento pelo cliente (link público "Meus agendamentos").
--
-- Marca status='cancelled', o que libera o horário (a checagem de conflito
-- ignora cancelados). Autorização (a função é SECURITY DEFINER, então valida
-- a posse manualmente):
--   • usuário logado dono do cliente (clients.profile_id = auth.uid()), OU
--   • telefone informado igual ao do cliente (mesma normalização E164 do booking).
-- Só permite cancelar agendamentos futuros e ainda em aberto (pending/confirmed).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.public_cancel_appointment(
  p_appointment uuid,
  p_phone text default null
)
 returns appointments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_appt appointments;
  v_phone text;
  v_profile uuid;
begin
  select a.* into v_appt from appointments a where a.id = p_appointment;
  if not found then raise exception 'not_found'; end if;

  select c.phone, c.profile_id into v_phone, v_profile
  from clients c where c.id = v_appt.client_id;

  if not (
       (v_profile is not null and v_profile = auth.uid())
    or (p_phone is not null and v_phone is not null and v_phone = p_phone)
  ) then
    raise exception 'forbidden';
  end if;

  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable';
  end if;
  if v_appt.starts_at <= now() then
    raise exception 'too_late';
  end if;

  update appointments
     set status = 'cancelled', updated_at = now()
   where id = p_appointment
   returning * into v_appt;

  return v_appt;
end;
$function$;

grant execute on function public.public_cancel_appointment(uuid, text) to anon, authenticated;
