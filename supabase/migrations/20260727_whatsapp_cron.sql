-- ─────────────────────────────────────────────────────────────────────────
-- WhatsApp — worker da fila no pg_cron.
--
-- Roda a cada minuto. Chamada barata: se não há nada elegível,
-- whatsapp_claim_next devolve vazio e a Edge Function retorna na hora.
--
-- Mesmo padrão de autenticação do send-push: segredo compartilhado no Vault,
-- conferido pela função num header. Não usa service_role key — menos
-- privilégio do que o necessário.
--
-- PRÉ-REQUISITO (rodar UMA VEZ, fora deste arquivo — não commitar segredo):
--   select vault.create_secret('<valor gerado>', 'whatsapp_webhook_secret', 'Worker da fila de WhatsApp');
-- O mesmo valor precisa estar como secret WHATSAPP_WEBHOOK_SECRET da Edge
-- Function send-whatsapp.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.whatsapp_drain()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_secret text;
  v_pendentes int;
begin
  -- Não acorda a Edge Function à toa: 1440 execuções/dia sem fila é
  -- desperdício. Só chama se existe algo esperando.
  select count(*) into v_pendentes
  from whatsapp_outbox
  where status = 'queued' and scheduled_for <= now();

  if v_pendentes = 0 then return; end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'whatsapp_webhook_secret';

  if v_secret is null then return; end if;

  perform net.http_post(
    url := 'https://lllibsgqpvgmpurzmram.supabase.co/functions/v1/send-whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-whatsapp-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$function$;

revoke execute on function public.whatsapp_drain() from anon, authenticated;

select cron.schedule('whatsapp-drain', '* * * * *', $$select public.whatsapp_drain();$$);

-- ── Higiene da fila ──────────────────────────────────────────────────────
-- Mensagem presa em 'sending' (worker morreu no meio, timeout de rede)
-- travaria o salão pra sempre, porque a serialização olha justamente por
-- 'sending'. Depois de 15min, devolve pra fila.
create or replace function public.whatsapp_unstick()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update whatsapp_outbox
  set status = case when attempts >= 4 then 'failed'::whatsapp_outbox_status
                    else 'queued'::whatsapp_outbox_status end,
      last_error = coalesce(last_error, 'travada_em_sending'),
      updated_at = now()
  where status = 'sending' and updated_at < now() - interval '15 minutes';
$function$;

revoke execute on function public.whatsapp_unstick() from anon, authenticated;

select cron.schedule('whatsapp-unstick', '*/10 * * * *', $$select public.whatsapp_unstick();$$);
