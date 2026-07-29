-- ─────────────────────────────────────────────────────────────────────────
-- O teto de 4 mensagens em 7 dias contava resposta como se fosse disparo.
--
-- Apareceu num teste real: um cliente da Barbearia Marcos ficou bloqueado
-- para recuperação com estas quatro na semana —
--
--   booking_receipt   (o salão mandou)
--   booking_receipt   (o salão mandou)
--   opt_out_ack       (ele escreveu SAIR, o sistema respondeu)
--   opt_in_ack        (ele escreveu VOLTAR, o sistema respondeu)
--
-- Duas dessas não são mensagem do salão: são resposta ao que ELE escreveu.
-- Contá-las inverte o sentido do teto. O teto existe para não incomodar quem
-- pode bloquear o número; quem acabou de pedir para voltar a receber é o
-- oposto de incomodado — e mesmo assim era ele quem ficava sem receber.
--
-- Pior: cria um jeito de o próprio cliente se silenciar sem querer. Duas
-- mensagens trocadas com o salão gastavam metade da cota da semana, e as
-- próximas sumiam caladas.
--
-- Os acks nunca passaram por teto nenhum para SAIR (whatsapp_reply insere
-- direto, e responder a quem escreveu é obrigação, não opção). O erro estava
-- só na conta: eles ocupavam vaga na cota dos outros.
-- ─────────────────────────────────────────────────────────────────────────

-- Um lugar só decidindo o que é disparo do salão e o que é resposta. Tipo
-- novo entra aqui e nos dois tetos de uma vez.
create or replace function public.whatsapp_kind_iniciada(
  p_kind public.whatsapp_message_kind
) returns boolean
 language sql
 immutable
as $function$
  select p_kind in (
    'booking_receipt', 'thank_you', 'reminder_confirm', 'review_request',
    'winback_no_show', 'winback_cancelled', 'winback_inactive'
  );
$function$;

-- ── Teto do transacional ─────────────────────────────────────────────────
create or replace function public.whatsapp_enqueue(
  p_appointment_id uuid,
  p_kind public.whatsapp_message_kind,
  p_delay interval default interval '0'
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inst record;
  v_appt record;
  v_phone text;
  v_body text;
  v_recentes int;
begin
  select a.id, a.salon_id, a.client_id, a.status
    into v_appt
  from appointments a where a.id = p_appointment_id;
  if v_appt is null or v_appt.client_id is null then return; end if;

  select * into v_inst from whatsapp_instances where salon_id = v_appt.salon_id;
  if v_inst is null or v_inst.status <> 'connected' then return; end if;

  -- Respeita o que o salão ligou
  if p_kind = 'booking_receipt'  and not v_inst.send_booking_receipt  then return; end if;
  if p_kind = 'thank_you'        and not v_inst.send_thank_you        then return; end if;
  if p_kind = 'reminder_confirm' and not v_inst.send_reminder_confirm then return; end if;
  if p_kind = 'review_request'   and not v_inst.send_review_request   then return; end if;

  -- Opt-out é definitivo
  select normalize_br_phone(c.phone) into v_phone
  from clients c
  where c.id = v_appt.client_id and not c.whatsapp_opt_out;
  if v_phone is null then return; end if;

  -- Teto de frequência: no máximo 4 mensagens por cliente em 7 dias, por mais
  -- transacional que seja. Quem recebe demais bloqueia. Só conta o que o
  -- salão iniciou — resposta a quem escreveu não é incômodo.
  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = v_appt.client_id
    and o.status in ('sent', 'queued', 'sending')
    and whatsapp_kind_iniciada(o.kind)
    and o.created_at > now() - interval '7 days';
  if v_recentes >= 4 then return; end if;

  v_body := whatsapp_render(p_kind, p_appointment_id);
  if v_body is null then return; end if;

  insert into whatsapp_outbox (salon_id, client_id, appointment_id, kind, phone, body, scheduled_for)
  values (v_appt.salon_id, v_appt.client_id, p_appointment_id, p_kind, v_phone, v_body, now() + p_delay)
  on conflict (appointment_id, kind) where appointment_id is not null do nothing;
end;
$function$;

revoke execute on function public.whatsapp_enqueue(uuid, public.whatsapp_message_kind, interval) from public, anon, authenticated;

-- ── Teto da recuperação ──────────────────────────────────────────────────
create or replace function public.whatsapp_winback_send(
  p_salon uuid,
  p_client uuid,
  p_bucket text,
  p_campaign uuid default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind public.whatsapp_message_kind;
  v_inst record;
  v_phone text;
  v_opt_out boolean;
  v_body text;
  v_cupom text;
  v_desc int;
  v_recentes int;
  v_hora int;
begin
  if not (has_permission(p_salon, 'campaigns.manage')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  v_kind := case p_bucket
    when 'no_shows'  then 'winback_no_show'
    when 'cancelled' then 'winback_cancelled'
    when 'inactive'  then 'winback_inactive'
    else null
  end::public.whatsapp_message_kind;
  if v_kind is null then
    return jsonb_build_object('ok', false, 'reason', 'bucket_invalido');
  end if;

  select normalize_br_phone(c.phone), c.whatsapp_opt_out
    into v_phone, v_opt_out
  from clients c
  where c.id = p_client and c.salon_id = p_salon;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'cliente_invalido');
  end if;

  select * into v_inst from whatsapp_instances where salon_id = p_salon;
  if v_inst is null or v_inst.status <> 'connected' then
    return jsonb_build_object('ok', false, 'reason', 'nao_conectado');
  end if;

  if coalesce(v_opt_out, false) then
    return jsonb_build_object('ok', false, 'reason', 'opt_out');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_telefone');
  end if;

  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = p_client
    and o.kind in ('winback_no_show', 'winback_cancelled', 'winback_inactive')
    and o.status in ('queued', 'sending', 'sent')
    and o.created_at > now() - interval '21 days';
  if v_recentes > 0 then
    return jsonb_build_object('ok', false, 'reason', 'ja_chamado');
  end if;

  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = p_client
    and o.status in ('queued', 'sending', 'sent')
    and whatsapp_kind_iniciada(o.kind)
    and o.created_at > now() - interval '7 days';
  if v_recentes >= 4 then
    return jsonb_build_object('ok', false, 'reason', 'limite_semanal');
  end if;

  if p_campaign is not null then
    select c.name, c.discount_percent into v_cupom, v_desc
    from campaigns c
    where c.id = p_campaign and c.salon_id = p_salon and c.is_active;
  end if;

  v_body := whatsapp_render_winback(v_kind, p_salon, p_client, v_cupom, v_desc);
  if v_body is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_template');
  end if;

  insert into whatsapp_outbox (salon_id, client_id, kind, phone, body)
  values (p_salon, p_client, v_kind, v_phone, v_body);

  update clients set last_contacted_at = now() where id = p_client;

  select extract(hour from (now() at time zone s.timezone))::int into v_hora
  from salons s where s.id = p_salon;

  return jsonb_build_object(
    'ok', true,
    'preview', v_body,
    'fora_janela', v_hora < 8 or v_hora > 19
  );
end;
$function$;

revoke execute on function public.whatsapp_winback_send(uuid, uuid, text, uuid) from public;
grant execute on function public.whatsapp_winback_send(uuid, uuid, text, uuid) to authenticated;
