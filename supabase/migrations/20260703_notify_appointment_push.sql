-- ─────────────────────────────────────────────────────────────────────────
-- Dispara notificação push (via Edge Function send-push) quando um
-- agendamento é criado ou cancelado. Trigger de banco em vez de chamada no
-- app porque agendamento é criado/cancelado por caminhos diferentes
-- (create_staff_appointment, book_appointment, public_cancel_appointment,
-- update direto de status pelo dropdown da Agenda) — no banco pega todos de
-- uma vez, na fonte da verdade.
--
-- Autenticação trigger → Edge Function: um segredo compartilhado guardado no
-- Vault (não a service_role key — menos privilégio do que precisa). A Edge
-- Function é publicada com --no-verify-jwt e confere esse mesmo valor num
-- header; só quem sabe o segredo consegue disparar push.
--
-- PRÉ-REQUISITO (rodado uma vez, fora deste arquivo — não commitar segredo
-- em texto puro no repo):
--   create extension if not exists pg_net;
--   select vault.create_secret('<valor gerado>', 'push_webhook_secret', '…');
-- O mesmo valor precisa estar também como secret PUSH_WEBHOOK_SECRET da
-- Edge Function send-push.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.notify_appointment_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event text;
  v_secret text;
begin
  if TG_OP = 'INSERT' then
    if NEW.status in ('cancelled', 'no_show', 'completed') then return NEW; end if;
    v_event := 'created';
  elsif TG_OP = 'UPDATE' and OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    v_event := 'cancelled';
  else
    return NEW;
  end if;

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

create trigger appointments_notify_push
  after insert or update of status on public.appointments
  for each row execute function public.notify_appointment_event();

-- Função interna de trigger, não é API — tira o EXECUTE público que o
-- Postgres concede por padrão (o trigger continua funcionando normalmente,
-- ele roda como dono da tabela, não via role de usuário).
revoke execute on function public.notify_appointment_event() from anon, authenticated;
