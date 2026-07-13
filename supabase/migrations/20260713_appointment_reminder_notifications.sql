-- ─────────────────────────────────────────────────────────────────────────
-- Lembrete "amanhã você tem horário" pra profissional, 1 dia antes do
-- agendamento. Diferente do notify_appointment_event (que dispara na hora,
-- via trigger), este é por cron: não existe um evento de banco pra "faltam
-- 24h", então uma função roda 1x/dia e varre os agendamentos de amanhã.
--
-- Vai só pra profissional dona do horário (member_id → profile_id), não pro
-- salão inteiro — diferente do created/cancelled que avisa todo mundo.
--
-- reminder_sent_at evita reenvio se o cron rodar de novo no mesmo dia (ou o
-- agendamento for editado sem mudar a data).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;

create or replace function public.send_appointment_reminders()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_secret text;
  r record;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';

  for r in
    select a.id as appointment_id, a.salon_id, a.starts_at, m.profile_id, c.full_name as client_name
    from appointments a
    join salon_members m on m.id = a.member_id
    left join clients c on c.id = a.client_id
    where a.reminder_sent_at is null
      and a.status not in ('cancelled', 'no_show', 'completed')
      and (a.starts_at at time zone 'America/Sao_Paulo')::date
          = ((now() at time zone 'America/Sao_Paulo')::date + 1)
  loop
    insert into notifications (salon_id, recipient_id, type, title, body, data)
    values (
      r.salon_id, r.profile_id, 'appointment_reminder', 'Amanhã você tem horário',
      coalesce(r.client_name, 'Cliente') || ' · ' ||
        to_char(r.starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      jsonb_build_object('appointment_id', r.appointment_id, 'event', 'reminder', 'starts_at', r.starts_at)
    );

    if v_secret is not null then
      perform net.http_post(
        url := 'https://lllibsgqpvgmpurzmram.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
        body := jsonb_build_object(
          'event', 'reminder', 'appointment_id', r.appointment_id,
          'salon_id', r.salon_id, 'profile_id', r.profile_id
        )
      );
    end if;

    update appointments set reminder_sent_at = now() where id = r.appointment_id;
  end loop;
end;
$function$;

revoke execute on function public.send_appointment_reminders() from anon, authenticated;

-- Agenda diária (23:00 UTC = 20:00 BRT) — fim do dia anterior ao horário.
-- Requer pg_cron (já habilitado pelo mrr-daily-snapshot).
select cron.schedule('appointment-reminders-daily', '0 23 * * *', $$select send_appointment_reminders();$$);
