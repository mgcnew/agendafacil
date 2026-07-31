-- ─────────────────────────────────────────────────────────────────────────
-- "A cliente não chegou" — um toque, saindo pelo número do salão.
--
-- O banner da Agenda já listava quem passou da hora, mas a ação era um link
-- wa.me: o dono saía do painel, caía no WhatsApp, e a mensagem ia pelo
-- aparelho dele. Fora do sistema, sem registro, sem respeitar opt-out e sem
-- entrar no histórico da cliente. Agora sai pela mesma fila de todo o resto.
--
-- ENVIO CONTINUA SENDO DECISÃO HUMANA. Nada dispara sozinho: cobrar um
-- atraso é julgamento (a cliente que sempre atrasa dez minutos não precisa de
-- mensagem) e, principalmente, o sistema não sabe quem já está sentado na
-- cadeira. O que mudou é só por onde a mensagem sai.
--
-- A JANELA DE SILÊNCIO É O DETALHE QUE MORDE. O worker só envia entre 8h e
-- 19h no fuso do salão (ver whatsapp_drain). Um aviso enfileirado às 20h30
-- ficaria parado e sairia às 8h do dia seguinte — "seu horário era às 20h,
-- ainda vem?", doze horas depois. Aviso de atraso vencido é pior que aviso
-- nenhum, então aqui ele é recusado na hora, com motivo, e a tela cai no
-- wa.me para quem quiser mandar assim mesmo.
-- ─────────────────────────────────────────────────────────────────────────

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'late_nudge',
   E'Oi, {cliente}! Tudo bem?\nSeu horário aqui era às {hora} e você ainda não apareceu 😊\n\nAinda consegue vir, ou prefere remarcar?{assinatura}{rodape}'),
  (null, 'late_nudge',
   E'{cliente}, tudo certo?\nTe esperei às {hora} para o {servico}.\n\nAinda dá pra vir, ou marcamos outro dia?{assinatura}{rodape}'),
  (null, 'late_nudge',
   E'Oi, {cliente}! Seu horário era às {hora} ⏰\nMe avisa se ainda consegue chegar — se não der, a gente remarca sem problema nenhum.{assinatura}{rodape}');

/**
 * Enfileira o aviso de atraso de UM agendamento. Um clique, um envio.
 *
 * Devolve jsonb em vez de erro para os casos previstos, pelo mesmo motivo do
 * `whatsapp_winback_send`: "essa cliente pediu para não receber" não é falha
 * do sistema, é resposta — e a tela precisa mostrar o motivo em português.
 */
create or replace function public.whatsapp_late_send(p_appointment uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid; v_client uuid; v_status appointment_status;
  v_starts timestamptz; v_ends timestamptz; v_tz text; v_hora int;
  v_inst record; v_phone text; v_opt boolean; v_body text; v_recentes int;
begin
  select a.salon_id, a.client_id, a.status, a.starts_at, a.ends_at, s.timezone
    into v_salon, v_client, v_status, v_starts, v_ends, v_tz
  from appointments a join salons s on s.id = a.salon_id
  where a.id = p_appointment;

  if v_salon is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;
  if not has_permission(v_salon, 'appointments.manage') then
    raise exception 'forbidden';
  end if;

  -- Já resolvido: chegou (in_progress), foi atendida, faltou ou cancelou.
  -- Aqui mora o valor do botão "Chegou": sem ele, este teste nunca protege
  -- ninguém e o aviso pode ir para quem está na cadeira.
  if v_status not in ('pending', 'confirmed') then
    return jsonb_build_object('ok', false, 'reason', 'ja_resolvido');
  end if;
  if v_starts > now() then
    return jsonb_build_object('ok', false, 'reason', 'ainda_nao_passou');
  end if;
  -- Muito depois já não é "você vem?", é cobrança. Passou o fim do
  -- atendimento com folga, o assunto é remarcar — e para isso existe a
  -- recuperação, que tem texto próprio.
  if now() > v_ends + interval '2 hours' then
    return jsonb_build_object('ok', false, 'reason', 'tarde_demais');
  end if;
  if v_client is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_cliente');
  end if;

  -- Janela de silêncio do worker (8h–19h). Ver o cabeçalho: enfileirar fora
  -- dela entregaria a mensagem no dia seguinte.
  v_hora := extract(hour from (now() at time zone coalesce(v_tz, 'America/Sao_Paulo')));
  if v_hora < 8 or v_hora > 19 then
    return jsonb_build_object('ok', false, 'reason', 'fora_do_horario');
  end if;

  select * into v_inst from whatsapp_instances where salon_id = v_salon;
  if v_inst is null or v_inst.status <> 'connected' then
    return jsonb_build_object('ok', false, 'reason', 'nao_conectado');
  end if;

  -- security definer ignora RLS: sem esta cláusula um id de outro salão
  -- passaria direto.
  select normalize_br_phone(c.phone), c.whatsapp_opt_out
    into v_phone, v_opt
  from clients c where c.id = v_client and c.salon_id = v_salon;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'cliente_invalido');
  end if;
  if coalesce(v_opt, false) then
    return jsonb_build_object('ok', false, 'reason', 'opt_out');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_telefone');
  end if;

  if exists (
    select 1 from whatsapp_outbox o
    where o.appointment_id = p_appointment and o.kind = 'late_nudge'
      and o.status in ('queued', 'sending', 'sent')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'ja_avisado');
  end if;

  -- Mesmo teto de 4/semana por cliente que o resto usa.
  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = v_client
    and o.status in ('queued', 'sending', 'sent')
    and o.created_at > now() - interval '7 days';
  if v_recentes >= 4 then
    return jsonb_build_object('ok', false, 'reason', 'limite_semanal');
  end if;

  v_body := whatsapp_render('late_nudge', p_appointment);
  if v_body is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_template');
  end if;

  insert into whatsapp_outbox (salon_id, client_id, appointment_id, kind, phone, body)
  values (v_salon, v_client, p_appointment, 'late_nudge', v_phone, v_body)
  on conflict (appointment_id, kind) where appointment_id is not null do nothing;

  update clients set last_contacted_at = now() where id = v_client;

  return jsonb_build_object('ok', true, 'body', v_body);
end;
$function$;

revoke execute on function public.whatsapp_late_send(uuid) from public, anon;
grant execute on function public.whatsapp_late_send(uuid) to authenticated;

-- NÃO entra em `whatsapp_kind_iniciada` de propósito: como o `home_confirmed`,
-- é resposta a uma situação que a própria cliente criou, não conversa que o
-- salão puxou para empurrar volume. Fazer o aviso consumir a cota de
-- iniciadas bloquearia o lembrete da véspera de quem atrasou uma vez. O teto
-- geral de 4/semana continua valendo — está checado acima.
