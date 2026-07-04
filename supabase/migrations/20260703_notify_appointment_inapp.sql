-- ─────────────────────────────────────────────────────────────────────────
-- Estende o trigger notify_appointment_event pra também gravar no "sino" do
-- painel (tabela notifications, por-destinatário com read_at). Além do push
-- que já existia, cada evento (novo agendamento / cancelamento) insere uma
-- notificação por membro ativo do salão — o badge/lido é individual.
--
-- A tabela notifications já existia (id, salon_id, recipient_id→profiles,
-- type, title, body, data jsonb, read_at, created_at) com RLS por
-- recipient_id = auth.uid(). A função é SECURITY DEFINER, então o insert
-- bypassa a RLS normalmente.
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

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
begin
  if TG_OP = 'INSERT' then
    if NEW.status in ('cancelled', 'no_show', 'completed') then return NEW; end if;
    v_event := 'created';
  elsif TG_OP = 'UPDATE' and OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    v_event := 'cancelled';
  else
    return NEW;
  end if;

  select c.full_name into v_client from clients c where c.id = NEW.client_id;

  -- Sino do painel: uma notificação por membro ativo do salão (badge/lido é
  -- individual via read_at). SECURITY DEFINER, então bypassa a RLS da tabela.
  insert into notifications (salon_id, recipient_id, type, title, body, data)
  select NEW.salon_id, m.profile_id,
         'appointment_' || v_event,
         case when v_event = 'created' then 'Novo agendamento' else 'Agendamento cancelado' end,
         coalesce(v_client, 'Cliente') || ' · ' ||
           to_char(NEW.starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
         jsonb_build_object('appointment_id', NEW.id, 'event', v_event, 'starts_at', NEW.starts_at)
  from salon_members m
  where m.salon_id = NEW.salon_id and m.is_active and m.profile_id is not null;

  -- Push (mesmo evento) — via Edge Function, autenticado por segredo do Vault.
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

revoke execute on function public.notify_appointment_event() from anon, authenticated;
