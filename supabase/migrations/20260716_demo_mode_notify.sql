-- Modo demo: salões demo não disparam push/notificação de agendamento.
-- Evita efeito externo (chamada à Edge Function send-push) e ruído quando um
-- prospect mexe no demo. Restante da lógica é idêntico ao original.
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
  -- Demo não notifica nem chama push.
  if (select is_demo from salons where id = NEW.salon_id) then
    return NEW;
  end if;

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
