-- ─────────────────────────────────────────────────────────────────────────
-- Inspiração da galeria no agendamento: a cliente marca fotos da galeria do
-- salão que gostou e o profissional vê essas fotos no atendimento (Agenda).
--
-- Guardado como array de ids em appointments (sem tabela nova). A escrita vem
-- de uma RPC SECURITY DEFINER que valida a posse do agendamento pelo telefone
-- (E164) ou login — mesmo padrão de public_cancel_appointment. A leitura na
-- Agenda reaproveita a leitura pública de salon_gallery.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.appointments
  add column if not exists inspiration_gallery_ids uuid[] not null default '{}';

create or replace function public.public_set_appointment_inspiration(
  p_appointment uuid,
  p_gallery_ids uuid[],
  p_phone text default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid;
  v_client uuid;
  v_phone text;
  v_profile uuid;
  v_valid uuid[];
begin
  select a.salon_id, a.client_id into v_salon, v_client
  from appointments a where a.id = p_appointment;
  if v_salon is null then raise exception 'not_found'; end if;

  select c.phone, c.profile_id into v_phone, v_profile
  from clients c where c.id = v_client;

  if not (
       (v_profile is not null and v_profile = auth.uid())
    or (p_phone is not null and v_phone is not null and v_phone = p_phone)
  ) then
    raise exception 'forbidden';
  end if;

  -- só ids que são fotos da galeria DESTE salão (ignora o resto)
  select coalesce(array_agg(g.id), '{}')
    into v_valid
  from salon_gallery g
  where g.salon_id = v_salon
    and g.id = any(coalesce(p_gallery_ids, '{}'));

  update appointments
     set inspiration_gallery_ids = v_valid, updated_at = now()
   where id = p_appointment;
end;
$function$;

grant execute on function public.public_set_appointment_inspiration(uuid, uuid[], text) to anon, authenticated;
