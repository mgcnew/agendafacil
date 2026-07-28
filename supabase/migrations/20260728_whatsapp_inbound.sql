-- ─────────────────────────────────────────────────────────────────────────
-- WhatsApp fase 2 — mensagens de entrada, opt-out real e confirmação D-1.
--
-- A fase 1 só mandava. Mas toda mensagem que sai termina com "Responda SAIR
-- para não receber mais mensagens" — uma promessa que, sem canal de entrada,
-- não era cumprida. Quem responde SAIR e continua recebendo faz a única coisa
-- que sobra: Bloquear. E bloqueio é justamente o sinal que mais pesa na
-- decisão do WhatsApp de derrubar o número. A frase existia pra evitar
-- bloqueio e, sem isto aqui, produzia bloqueio.
--
-- Além do opt-out, o canal de entrada habilita a confirmação D-1: "confirma
-- amanhã?" só vale a pena se a resposta chegar a algum lugar.
--
-- Segurança: quem chama é a rota /api/whatsapp/webhook com service_role,
-- depois de conferir o segredo. Nada aqui é exposto a anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Caixa de entrada ─────────────────────────────────────────────────────
-- Guarda TODA mensagem recebida, inclusive as que não sabemos interpretar.
-- Três motivos: provar que o opt-out foi respeitado (LGPD), dar ao suporte o
-- histórico dos dois lados, e mostrar ao salão o que o cliente respondeu
-- quando a gente não entendeu.
create table public.whatsapp_inbox (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  -- Agendamento que a resposta afetou, quando ela afetou algum.
  appointment_id uuid references public.appointments(id) on delete set null,

  phone text not null,
  body text not null,
  intent text not null,              -- opt_out | confirm | decline | unknown
  acted boolean not null default false,

  -- Id da mensagem na Evolution. A entrega do webhook é "pelo menos uma vez":
  -- sem isto, uma reentrega viraria segundo cancelamento.
  provider_message_id text unique,

  created_at timestamptz not null default now()
);

create index whatsapp_inbox_salon_idx on public.whatsapp_inbox(salon_id, created_at desc);

alter table public.whatsapp_inbox enable row level security;

-- Leitura pra equipe do salão; escrita é exclusiva do worker (service_role).
create policy whatsapp_inbox_select_own on public.whatsapp_inbox
  for select using (
    exists (
      select 1 from public.salon_members m
      where m.salon_id = whatsapp_inbox.salon_id and m.profile_id = auth.uid()
    )
  );

-- Busca de cliente por telefone normalizado acontece a CADA mensagem que
-- chega. Sem índice funcional seria varredura na tabela inteira toda vez.
create index clients_phone_normalized_idx
  on public.clients(salon_id, public.normalize_br_phone(phone));

-- ── Interpretação da resposta ────────────────────────────────────────────
-- Sem acento, sem pontuação, minúscula, espaço colapsado. "Não!" e "NAO"
-- viram a mesma coisa.
create or replace function public.whatsapp_normalize_text(p_raw text)
 returns text
 language sql
 immutable
as $function$
  select trim(regexp_replace(
    regexp_replace(
      translate(
        lower(coalesce(p_raw, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9 ]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$function$;

-- Casamento EXATO com a mensagem inteira, nunca "contém". A diferença é o que
-- separa cancelar o horário certo de cancelar por engano: "nao" cancela,
-- "nao sei se consigo chegar" não casa com nada e vira unknown — que avisa o
-- salão em vez de agir. Na dúvida, quem decide é gente.
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

-- ── Respostas automáticas ────────────────────────────────────────────────
-- Enfileira direto no outbox, sem passar por whatsapp_enqueue, porque um ack
-- precisa furar as travas que existem pra disparo em massa:
--   · o opt-out (o ack do SAIR vai justamente pra quem acabou de sair)
--   · o teto de 4 mensagens/7 dias (responder não é fazer campanha)
--   · os toggles do salão (não se desliga educação)
-- O ritmo, a janela de silêncio e o teto diário continuam valendo: quem
-- decide isso é whatsapp_claim_next, e o ack passa por ele como qualquer um.
create or replace function public.whatsapp_reply(
  p_salon_id uuid,
  p_client_id uuid,
  p_appointment_id uuid,
  p_kind public.whatsapp_message_kind,
  p_body text,
  p_phone text
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into whatsapp_outbox (salon_id, client_id, appointment_id, kind, phone, body)
  values (p_salon_id, p_client_id, p_appointment_id, p_kind, p_phone, p_body)
  on conflict (appointment_id, kind) where appointment_id is not null do nothing;
end;
$function$;

revoke execute on function public.whatsapp_reply(uuid, uuid, uuid, public.whatsapp_message_kind, text, text) from public, anon, authenticated;

-- ── Aviso ao salão ───────────────────────────────────────────────────────
-- Cliente cancelou ou escreveu algo que não entendemos: alguém precisa saber.
-- Vai pro profissional do horário; sem ele, pro dono.
create or replace function public.whatsapp_notify_salon(
  p_salon_id uuid,
  p_appointment_id uuid,
  p_title text,
  p_body text,
  -- Dois tipos porque o sino desenha por tipo: cancelamento tem que chegar
  -- vermelho, mensagem solta não.
  p_type text default 'whatsapp_reply'
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_recipient uuid;
begin
  if p_appointment_id is not null then
    select m.profile_id into v_recipient
    from appointments a
    join salon_members m on m.id = a.member_id
    where a.id = p_appointment_id;
  end if;

  if v_recipient is null then
    select m.profile_id into v_recipient
    from salon_members m
    where m.salon_id = p_salon_id and m.role = 'owner'
    limit 1;
  end if;

  if v_recipient is null then return; end if;

  insert into notifications (salon_id, recipient_id, type, title, body, data)
  values (
    p_salon_id, v_recipient, p_type, p_title, p_body,
    jsonb_build_object('appointment_id', p_appointment_id, 'event', 'whatsapp_reply')
  );
end;
$function$;

revoke execute on function public.whatsapp_notify_salon(uuid, uuid, text, text, text) from public, anon, authenticated;

-- ── Porta de entrada ─────────────────────────────────────────────────────
-- Um ponto só, chamado pela rota do webhook. Devolve jsonb pra rota poder
-- logar o que aconteceu sem precisar consultar de novo.
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

  select c.id, c.full_name into v_client_id, v_client_name
  from clients c
  where c.salon_id = v_salon_id and normalize_br_phone(c.phone) = v_phone
  limit 1;

  v_intent := whatsapp_classify(p_body);

  -- Grava antes de agir. Se o webhook reentregar (a Evolution entrega "pelo
  -- menos uma vez"), o unique barra aqui e nada é executado duas vezes.
  insert into whatsapp_inbox (salon_id, client_id, phone, body, intent, provider_message_id)
  values (v_salon_id, v_client_id, v_phone, left(p_body, 4000), v_intent, p_provider_message_id)
  on conflict (provider_message_id) do nothing
  returning id into v_inbox_id;

  if v_inbox_id is null then
    return jsonb_build_object('ok', true, 'duplicada', true);
  end if;

  -- ── SAIR ───────────────────────────────────────────────────────────────
  -- Vale mesmo sem cliente cadastrado: a pessoa pediu pra parar, e a promessa
  -- não tinha letra miúda. Sem cadastro só não há o que marcar.
  if v_intent = 'opt_out' then
    if v_client_id is not null then
      update clients
      set whatsapp_opt_out = true, whatsapp_opt_out_at = now()
      where id = v_client_id;

      -- O que ainda não saiu não sai mais.
      update whatsapp_outbox
      set status = 'skipped', skip_reason = 'opt_out', updated_at = now()
      where client_id = v_client_id and status = 'queued';

      perform whatsapp_reply(
        v_salon_id, v_client_id, null, 'opt_out_ack',
        'Pronto! Você não vai mais receber mensagens automáticas do *' ||
        coalesce(v_salon_name, 'salão') ||
        '*. Se mudar de ideia, é só avisar a gente por aqui. 💚',
        v_phone
      );
    end if;

    update whatsapp_inbox set acted = true where id = v_inbox_id;
    return jsonb_build_object('ok', true, 'intent', 'opt_out', 'client_id', v_client_id);
  end if;

  -- ── Confirmar / desmarcar ──────────────────────────────────────────────
  -- Só faz sentido se a gente PERGUNTOU: a resposta é lida como resposta do
  -- último lembrete enviado a este número. Sem lembrete recente, um "sim"
  -- solto é conversa, não comando.
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
      -- O trigger de appointments cuida do resto ao ver 'cancelled': tudo que
      -- estava na fila pra este agendamento é descartado.
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

  -- ── Não entendemos ─────────────────────────────────────────────────────
  -- Nada de responder com robô ("não entendi, digite 1"). Cliente escreveu
  -- para uma pessoa; quem responde é a pessoa. A gente só avisa que chegou.
  perform whatsapp_notify_salon(
    v_salon_id, null,
    'Mensagem no WhatsApp',
    coalesce(v_client_name, v_phone) || ': ' || left(p_body, 120)
  );

  return jsonb_build_object('ok', true, 'intent', v_intent, 'acted', false);
end;
$function$;

revoke execute on function public.whatsapp_handle_inbound(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_normalize_text(text) from public, anon, authenticated;
revoke execute on function public.whatsapp_classify(text) from public, anon, authenticated;

-- ── Templates do lembrete D-1 ────────────────────────────────────────────
-- Pedem resposta de propósito. Além de reduzir falta, cada "sim" que chega é
-- conversa de duas vias — o padrão que o WhatsApp premia e que separa o
-- número que atende do número que só dispara.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'reminder_confirm',
   E'Oi, {cliente}! 💚\nPassando pra lembrar do seu horário no *{salao}* amanhã:\n\n📅 {data} às {hora}\n💇 {servico}\n\nConfirma pra gente? Responda *SIM* ou *NÃO*.\n\n_Responda SAIR para não receber mais mensagens._'),
  (null, 'reminder_confirm',
   E'{cliente}, tudo bem? ✨\nSeu horário no *{salao}* é amanhã:\n\n📅 {data} · {hora}\n💇 {servico}\n\nResponda *SIM* pra confirmar ou *NÃO* se não puder vir.\n\n_Responda SAIR para não receber mais mensagens._'),
  (null, 'reminder_confirm',
   E'Olá, {cliente}! Aqui é do *{salao}*.\nSeu horário está chegando:\n\n📅 amanhã, {data} às {hora}\n💇 {servico}\n\nDá pra confirmar? Responda *SIM* ou *NÃO*.\n\n_Responda SAIR para não receber mais mensagens._');

-- ── Disparo do lembrete ──────────────────────────────────────────────────
-- Roda de hora em hora, mas só age no salão onde são 10h da manhã. É por isso
-- que o fuso é por salão e não fixo em São Paulo: Manaus e Rio Branco também
-- merecem receber às 10h locais, não às 8h.
create or replace function public.whatsapp_enqueue_reminders()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_total int := 0;
begin
  for r in
    select a.id
    from appointments a
    join salons s on s.id = a.salon_id
    join whatsapp_instances i on i.salon_id = a.salon_id
    where i.status = 'connected'
      and i.send_reminder_confirm
      and a.status in ('pending', 'confirmed')
      and extract(hour from (now() at time zone s.timezone)) = 10
      and (a.starts_at at time zone s.timezone)::date
          = ((now() at time zone s.timezone)::date + 1)
  loop
    -- whatsapp_enqueue reconfere tudo (opt-out, telefone, teto) e o índice
    -- único (appointment_id, kind) garante que rodar duas vezes não duplica.
    perform whatsapp_enqueue(r.id, 'reminder_confirm');
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$function$;

revoke execute on function public.whatsapp_enqueue_reminders() from public, anon, authenticated;

select cron.schedule('whatsapp-reminders', '0 * * * *', $$select public.whatsapp_enqueue_reminders();$$);
