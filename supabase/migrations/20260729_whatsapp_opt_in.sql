-- ─────────────────────────────────────────────────────────────────────────
-- WhatsApp — voltar a receber, e o salão enxergar quem saiu.
--
-- O ack do SAIR prometia "se mudar de ideia, é só avisar a gente por aqui" e
-- não havia do que ser cumprido: `whatsapp_opt_out` não aparecia em lugar
-- nenhum da interface e não existia palavra de volta. Mesmo erro do "Responda
-- SAIR" original — prometer o que o sistema não faz.
--
-- Três coisas, que só funcionam juntas:
--   1. intenção 'opt_in' com as palavras de volta (aqui)
--   2. selo + botão "Religar mensagens" na ficha do cliente (ClientDetail)
--   3. aviso ao salão quando alguém sai — antes o opt-out era silencioso
--
-- O item 2 é o essencial: quem pede pra voltar quase sempre pede na cadeira,
-- não por mensagem.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.whatsapp_classify(p_body text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when t in ('sair', 'parar', 'pare', 'stop', 'remover', 'descadastrar',
               'sair da lista', 'nao quero receber', 'nao quero mais receber',
               'para de mandar', 'nao me mande mais mensagens')
      then 'opt_out'
    when t in ('voltar', 'volta', 'quero receber', 'quero voltar',
               'voltar a receber', 'quero voltar a receber', 'receber',
               'me inclua', 'quero as mensagens', 'pode mandar')
      then 'opt_in'
    when t in ('sim', 's', '1', 'ok', 'okay', 'confirmo', 'confirmado',
               'confirmar', 'isso', 'isso mesmo', 'beleza', 'blz', 'vou',
               'sim vou', 'claro', 'positivo', 'ta certo', 'ta bom', 'tudo certo')
      then 'confirm'
    when t in ('nao', 'n', '2', 'nao vou', 'nao posso', 'nao consigo',
               'cancelar', 'cancela', 'desmarcar', 'negativo', 'nao da')
      then 'decline'
    else 'unknown'
  end
  from (select public.whatsapp_normalize_text(p_body) as t) x;
$function$;

revoke execute on function public.whatsapp_classify(text) from public, anon, authenticated;

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
  -- é palavra solta numa conversa — e responder "você voltou a receber" a
  -- quem nunca saiu é confuso. Vira unknown e o salão decide.
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

      -- O salão precisa saber: senão o cliente some das mensagens e ninguém
      -- entende por quê.
      perform whatsapp_notify_salon(
        v_salon_id, null,
        'Cliente saiu das mensagens',
        coalesce(v_client_name, v_phone) ||
        ' pediu para não receber mais WhatsApp. Dá pra religar na ficha dele.'
      );
    end if;

    update whatsapp_inbox set acted = true where id = v_inbox_id;
    return jsonb_build_object('ok', true, 'intent', 'opt_out', 'client_id', v_client_id);
  end if;

  -- ── VOLTAR ─────────────────────────────────────────────────────────────
  -- Pedido escrito pelo próprio cliente é consentimento, e fica registrado na
  -- whatsapp_inbox com data e texto — que é o que a LGPD pede pra provar.
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
      coalesce(v_client_name, v_phone) || ' pediu para voltar a receber WhatsApp.'
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

  perform whatsapp_notify_salon(
    v_salon_id, null,
    'Mensagem no WhatsApp',
    coalesce(v_client_name, v_phone) || ': ' || left(p_body, 120)
  );

  return jsonb_build_object('ok', true, 'intent', v_intent, 'acted', false);
end;
$function$;

revoke execute on function public.whatsapp_handle_inbound(text, text, text, text) from public, anon, authenticated;

-- Os templates prometiam só "SAIR". Agora que voltar é possível, o rodapé diz
-- as duas coisas — a saída fácil continua sendo o item anti-ban de maior
-- retorno, e a volta fácil evita perder o cliente que saiu por impulso.
update public.whatsapp_templates
set body = replace(
  body,
  '_Responda SAIR para não receber mais mensagens._',
  '_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'
)
where body like '%Responda SAIR para não receber mais mensagens._%';
