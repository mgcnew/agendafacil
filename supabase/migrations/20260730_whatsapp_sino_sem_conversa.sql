-- ─────────────────────────────────────────────────────────────────────────
-- O sino virou caixa de entrada do WhatsApp. Não pode.
--
-- whatsapp_handle_inbound terminava com um aviso genérico pra TODA mensagem
-- que não fosse comando reconhecido:
--
--   perform whatsapp_notify_salon(..., 'Mensagem no WhatsApp',
--           cliente || ': ' || left(p_body, 120));
--
-- Cliente responde "Blz", "Já", "Bom dia. Ok", "Paz 🤣" ao comprovante de
-- agendamento — e cada uma dessas vira notificação de sistema. Em pouco mais
-- de um dia foram 34, contra 54 mensagens recebidas no total.
--
-- Dois caminhos alimentavam isso:
--   · intent 'unknown' (a maioria: resposta conversa normal);
--   · 'confirm'/'decline' que NÃO acharam um reminder_confirm enviado nas
--     últimas 48h — caíam no mesmo fim de função. Como a confirmação da
--     véspera só foi ligada agora, quase todo "Blz" é resposta ao comprovante
--     e cai por aqui.
--
-- O erro de conceito é anterior ao código: o salão JÁ recebe essas mensagens
-- no WhatsApp dele, no celular. Repetir a conversa dentro do painel não
-- informa nada novo — só enterra as notificações que importam (agendamento
-- criado, cancelado, lembrete) debaixo de "Blz".
--
-- Fica no sino só o que tem consequência operacional e não aparece em outro
-- lugar do sistema:
--   · cancelou pelo WhatsApp → a agenda mudou sozinha
--   · saiu / voltou às mensagens → o cliente muda de estado e some (ou volta)
--     dos envios, e isso não é visível em lugar nenhum senão na ficha dele
--
-- Cada um ganha tipo próprio, pra nunca mais dividir balde com conversa.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.whatsapp_handle_inbound(
  p_instance_name text,
  p_phone_raw text,
  p_body text,
  p_provider_message_id text default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon_id uuid;
  v_salon_name text;
  v_phone text;
  v_client_id uuid;
  v_client_name text;
  v_opt_out boolean;
  v_intent text;
  v_inbox_id uuid;
  v_appt_id uuid;
  v_quando text;
begin
  select i.salon_id into v_salon_id
  from whatsapp_instances i where i.instance_name = p_instance_name;
  if v_salon_id is null then
    return jsonb_build_object('ok', false, 'reason', 'instancia_desconhecida');
  end if;

  v_phone := normalize_br_phone(p_phone_raw);
  if v_phone is null then
    return jsonb_build_object('ok', false, 'reason', 'telefone_invalido');
  end if;

  select s.name into v_salon_name from salons s where s.id = v_salon_id;

  select c.id, c.full_name, c.whatsapp_opt_out
    into v_client_id, v_client_name, v_opt_out
  from clients c
  where c.salon_id = v_salon_id and normalize_br_phone(c.phone) = v_phone
  limit 1;

  v_intent := whatsapp_classify(p_body);

  -- "voltar" só é comando pra quem saiu. Pra quem está recebendo normalmente
  -- é palavra solta numa conversa.
  if v_intent = 'opt_in' and coalesce(v_opt_out, false) = false then
    v_intent := 'unknown';
  end if;

  insert into whatsapp_inbox (salon_id, client_id, phone, body, intent, provider_message_id)
  values (v_salon_id, v_client_id, v_phone, left(p_body, 4000), v_intent, p_provider_message_id)
  on conflict (provider_message_id) do nothing
  returning id into v_inbox_id;

  if v_inbox_id is null then
    return jsonb_build_object('ok', true, 'duplicada', true);
  end if;

  -- ── SAIR ───────────────────────────────────────────────────────────────
  if v_intent = 'opt_out' then
    if v_client_id is not null then
      update clients
      set whatsapp_opt_out = true, whatsapp_opt_out_at = now()
      where id = v_client_id;

      update whatsapp_outbox
      set status = 'skipped', skip_reason = 'opt_out', updated_at = now()
      where client_id = v_client_id and status = 'queued';

      perform whatsapp_reply(
        v_salon_id, v_client_id, null, 'opt_out_ack',
        'Pronto! Você não vai mais receber mensagens automáticas do *' ||
        coalesce(v_salon_name, 'salão') ||
        '*. Se mudar de ideia, responda *VOLTAR* ou avise a gente.',
        v_phone
      );

      perform whatsapp_notify_salon(
        v_salon_id, null,
        'Cliente saiu das mensagens',
        coalesce(v_client_name, v_phone) ||
        ' pediu para não receber mais WhatsApp. Dá pra religar na ficha dele.',
        'whatsapp_opt_out'
      );
    end if;

    update whatsapp_inbox set acted = true where id = v_inbox_id;
    return jsonb_build_object('ok', true, 'intent', 'opt_out', 'client_id', v_client_id);
  end if;

  -- ── VOLTAR ─────────────────────────────────────────────────────────────
  if v_intent = 'opt_in' then
    update clients
    set whatsapp_opt_out = false, whatsapp_opt_out_at = null
    where id = v_client_id;

    perform whatsapp_reply(
      v_salon_id, v_client_id, null, 'opt_in_ack',
      'Feito! Você voltou a receber as mensagens do *' ||
      coalesce(v_salon_name, 'salão') ||
      '*: confirmação de horário e lembretes. 💚',
      v_phone
    );

    perform whatsapp_notify_salon(
      v_salon_id, null,
      'Cliente voltou às mensagens',
      coalesce(v_client_name, v_phone) || ' pediu para voltar a receber WhatsApp.',
      'whatsapp_opt_in'
    );

    update whatsapp_inbox set acted = true where id = v_inbox_id;
    return jsonb_build_object('ok', true, 'intent', 'opt_in', 'client_id', v_client_id);
  end if;

  -- ── Confirmar / desmarcar ──────────────────────────────────────────────
  if v_intent in ('confirm', 'decline') and v_client_id is not null then
    select o.appointment_id into v_appt_id
    from whatsapp_outbox o
    where o.salon_id = v_salon_id
      and o.phone = v_phone
      and o.kind = 'reminder_confirm'
      and o.status = 'sent'
      and o.sent_at > now() - interval '48 hours'
      and o.appointment_id is not null
    order by o.sent_at desc
    limit 1;
  end if;

  if v_appt_id is not null then
    select to_char(a.starts_at at time zone s.timezone, 'DD/MM às HH24:MI')
      into v_quando
    from appointments a join salons s on s.id = a.salon_id
    where a.id = v_appt_id;

    if v_intent = 'confirm' then
      update appointments set status = 'confirmed'
      where id = v_appt_id and status = 'pending';

      perform whatsapp_reply(
        v_salon_id, v_client_id, v_appt_id, 'confirm_ack',
        'Show! Seu horário de ' || v_quando || ' está confirmado. Até lá! 💚',
        v_phone
      );
    else
      update appointments set status = 'cancelled'
      where id = v_appt_id and status in ('pending', 'confirmed');

      perform whatsapp_reply(
        v_salon_id, v_client_id, v_appt_id, 'decline_ack',
        'Tudo bem, cancelamos seu horário de ' || v_quando ||
        '. Quando quiser remarcar é só chamar por aqui!',
        v_phone
      );

      -- Único aviso de sino que sobrou vindo de mensagem: aqui a agenda mudou
      -- sozinha, e quem não souber vai esperar um cliente que não vem.
      perform whatsapp_notify_salon(
        v_salon_id, v_appt_id,
        'Cliente cancelou pelo WhatsApp',
        coalesce(v_client_name, 'Cliente') || ' desmarcou o horário de ' || v_quando,
        'whatsapp_cancelled'
      );
    end if;

    update whatsapp_inbox
    set acted = true, appointment_id = v_appt_id
    where id = v_inbox_id;

    return jsonb_build_object('ok', true, 'intent', v_intent, 'appointment_id', v_appt_id);
  end if;

  -- Fim da linha: conversa normal ("Blz", "Já", "Bom dia"), ou um
  -- confirm/decline sem lembrete recente pra casar. Fica registrado na
  -- whatsapp_inbox e NADA vai pro sino — quem precisa ler isso já tem a
  -- conversa aberta no WhatsApp do próprio salão.
  return jsonb_build_object('ok', true, 'intent', v_intent, 'acted', false);
end;
$function$;

revoke execute on function public.whatsapp_handle_inbound(text, text, text, text) from public, anon, authenticated;

-- Limpa o que o defeito produziu. Escopo estreito de propósito: só o título
-- exato que a função gerava, pra não levar junto o "cliente saiu das
-- mensagens" nem nenhum aviso legítimo que use o mesmo tipo antigo.
delete from public.notifications
where type = 'whatsapp_reply' and title = 'Mensagem no WhatsApp';
