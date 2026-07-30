-- ─────────────────────────────────────────────────────────────────────────
-- Pedido de avaliação no Google — ligando um interruptor que não fazia nada.
--
-- `send_review_request` existia desde o começo: coluna, interruptor na tela de
-- WhatsApp e uma trava em whatsapp_enqueue. Faltava tudo o que importa —
-- nenhum template e nada que enfileirasse. Ligar não mandava mensagem
-- nenhuma, o que é pior que não ter o recurso: o dono acha que está pedindo
-- avaliação e não está.
--
-- Quatro decisões que definem o resultado:
--
-- 1. UM DIA DEPOIS, à tarde. O agradecimento já sai 20min após o atendimento;
--    duas mensagens seguidas viram spam. No dia seguinte a pessoa já viu o
--    resultado em casa e provavelmente ouviu elogio — é quando ela tem o que
--    dizer.
--
-- 2. SÓ QUEM VOLTOU (2+ atendimentos concluídos). Pedir pra todo mundo é como
--    se junta avaliação de 2 estrelas: quem teve experiência ruim e ia
--    esquecer o assunto recebe um convite pra escrever sobre ela. Voltar é o
--    sinal de satisfação mais confiável que existe, porque é comportamento e
--    não opinião.
--
-- 3. UMA VEZ POR CLIENTE, nunca mais. Pedir duas vezes pra mesma pessoa é o
--    caminho mais curto pro bloqueio.
--
-- 4. SÓ COM O LINK DO GOOGLE preenchido. Sem ele a mensagem não tem destino.
--
-- O que este arquivo deliberadamente NÃO faz: perguntar a nota antes e mandar
-- pro Google só quem responde bem. Isso é review gating, o Google proíbe, e a
-- punição cai no salão (avaliações removidas, ficha penalizada na busca
-- local). Pelo mesmo motivo o texto não pede estrela nem oferece desconto em
-- troca — as duas coisas violam a política de avaliações.
-- ─────────────────────────────────────────────────────────────────────────

-- ── {google} no render ───────────────────────────────────────────────────
create or replace function public.whatsapp_render(
  p_kind public.whatsapp_message_kind,
  p_appointment_id uuid
) returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_body text;
  r record;
  v_servico text;
  v_insta text;
begin
  select a.salon_id into r from appointments a where a.id = p_appointment_id;

  select t.body into v_body
  from whatsapp_templates t
  where t.kind = p_kind and t.is_active
    and (t.salon_id = r.salon_id or t.salon_id is null)
  order by (t.salon_id is null), random()
  limit 1;

  if v_body is null then return null; end if;

  select
    coalesce(c.full_name, 'tudo bem') as cliente,
    s.name as salao,
    to_char(a.starts_at at time zone s.timezone, 'DD/MM') as data,
    to_char(a.starts_at at time zone s.timezone, 'HH24:MI') as hora,
    instagram_handle(s.instagram) as insta,
    nullif(btrim(coalesce(s.google_business, '')), '') as google
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  where a.id = p_appointment_id;

  if r is null then return null; end if;

  -- Pedido de avaliação sem link não é mensagem, é frase sem fim. Melhor não
  -- existir do que sair pela metade.
  if p_kind = 'review_request' and r.google is null then return null; end if;

  select string_agg(aps.name, ' + ' order by aps.name) into v_servico
  from appointment_services aps
  where aps.appointment_id = p_appointment_id;

  v_insta := case
    when r.insta is null then ''
    else E'\n\n📸 A gente posta os trabalhos no Instagram: instagram.com/' || r.insta
  end;

  v_body := replace(v_body, '{cliente}',   split_part(r.cliente, ' ', 1));
  v_body := replace(v_body, '{salao}',     r.salao);
  v_body := replace(v_body, '{data}',      r.data);
  v_body := replace(v_body, '{hora}',      r.hora);
  v_body := replace(v_body, '{servico}',   coalesce(v_servico, 'Atendimento'));
  v_body := replace(v_body, '{instagram}', v_insta);
  v_body := replace(v_body, '{google}',    coalesce(r.google, ''));

  return v_body;
end;
$function$;

-- ── Templates ────────────────────────────────────────────────────────────
-- Sem "nos dê 5 estrelas": pedir nota específica é proibido pelo Google. O
-- pedido é pela opinião, e a justificativa é honesta — avaliação de fato
-- ajuda quem procura salão na região.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'review_request',
   E'Oi, {cliente}! Ontem foi um prazer te atender no *{salao}* 💚\n\nSe sobrar um minutinho, conta pra gente como foi? Ajuda bastante quem está procurando por aqui:\n{google}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'review_request',
   E'{cliente}, tudo bem?\nQue bom te ver de novo no *{salao}* ontem! ✨\n\nSua opinião vale muito pra gente — se puder deixar registrada, é rapidinho:\n{google}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'review_request',
   E'Oi, {cliente}! Aqui é do *{salao}*.\nEsperamos que tenha gostado do resultado 💚\n\nSe quiser contar como foi, deixa uma avaliação — ajuda outras pessoas a conhecerem a gente:\n{google}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._')
on conflict do nothing;

-- ── Travas no ponto único de entrada da fila ─────────────────────────────
-- Ficam aqui, e não só no cron, pra que qualquer chamada futura herde as
-- mesmas regras sem precisar lembrar delas.
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

  if p_kind = 'booking_receipt'  and not v_inst.send_booking_receipt  then return; end if;
  if p_kind = 'thank_you'        and not v_inst.send_thank_you        then return; end if;
  if p_kind = 'reminder_confirm' and not v_inst.send_reminder_confirm then return; end if;
  if p_kind = 'review_request'   and not v_inst.send_review_request   then return; end if;

  -- Avaliação: uma por cliente na vida. O índice único da fila é por
  -- (appointment_id, kind) e não impediria pedir de novo no atendimento
  -- seguinte — que é justamente o incômodo a evitar.
  if p_kind = 'review_request' then
    if exists (
      select 1 from whatsapp_outbox o
      where o.client_id = v_appt.client_id
        and o.kind = 'review_request'
        and o.status in ('queued', 'sending', 'sent')
    ) then return; end if;
  end if;

  select normalize_br_phone(c.phone) into v_phone
  from clients c
  where c.id = v_appt.client_id and not c.whatsapp_opt_out;
  if v_phone is null then return; end if;

  -- Teto de 4 por cliente em 7 dias, contando só o que o salão iniciou.
  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = v_appt.client_id
    and o.status in ('sent', 'queued', 'sending')
    and whatsapp_kind_iniciada(o.kind)
    and o.created_at > now() - interval '7 days';
  if v_recentes >= 4 then return; end if;

  -- Devolve null quando o pedido de avaliação não tem link do Google.
  v_body := whatsapp_render(p_kind, p_appointment_id);
  if v_body is null then return; end if;

  insert into whatsapp_outbox (salon_id, client_id, appointment_id, kind, phone, body, scheduled_for)
  values (v_appt.salon_id, v_appt.client_id, p_appointment_id, p_kind, v_phone, v_body, now() + p_delay)
  on conflict (appointment_id, kind) where appointment_id is not null do nothing;
end;
$function$;

revoke execute on function public.whatsapp_enqueue(uuid, public.whatsapp_message_kind, interval) from public, anon, authenticated;

-- ── Cron ─────────────────────────────────────────────────────────────────
-- Roda de hora em hora e só age às 15h no fuso de cada salão — mesmo desenho
-- do lembrete da véspera, que dispara às 10h. Reexecutar não duplica: o
-- índice único da fila e a trava de "uma por cliente" seguram.
create or replace function public.whatsapp_enqueue_reviews()
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
    -- distinct on: quem veio duas vezes ontem não pode gerar dois pedidos. A
    -- trava de "uma por cliente" também seguraria, mas depender dela aqui
    -- seria contar com o efeito colateral de outra função.
    select distinct on (a.client_id) a.id
    from appointments a
    join salons s on s.id = a.salon_id
    join whatsapp_instances i on i.salon_id = a.salon_id
    where i.status = 'connected'
      and i.send_review_request
      and nullif(btrim(coalesce(s.google_business, '')), '') is not null
      and a.status = 'completed'
      and a.client_id is not null
      and extract(hour from (now() at time zone s.timezone)) = 15
      and (a.starts_at at time zone s.timezone)::date
          = ((now() at time zone s.timezone)::date - 1)
      -- Só quem voltou: 2+ atendimentos concluídos neste salão.
      and (
        select count(*) from appointments a2
        where a2.salon_id = a.salon_id
          and a2.client_id = a.client_id
          and a2.status = 'completed'
      ) >= 2
      -- Nunca pedido antes a esta pessoa.
      and not exists (
        select 1 from whatsapp_outbox o
        where o.client_id = a.client_id
          and o.kind = 'review_request'
          and o.status in ('queued', 'sending', 'sent')
      )
    order by a.client_id, a.starts_at desc
  loop
    perform whatsapp_enqueue(r.id, 'review_request');
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$function$;

revoke execute on function public.whatsapp_enqueue_reviews() from public, anon, authenticated;

select cron.schedule('whatsapp-reviews', '5 * * * *', $$select public.whatsapp_enqueue_reviews();$$);
