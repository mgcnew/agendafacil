-- ─────────────────────────────────────────────────────────────────────────
-- Mensagens automáticas novas: o salão para de depender de alguém lembrar.
--
--   1. Sentimos sua falta   — passou o prazo sem voltar (winback_inactive)
--   2. Aniversário          — no dia, com cupom opcional (birthday)
--   3. Vaga liberada        — cancelaram no dia que a cliente da lista de
--                             espera queria (waitlist_open)
--   4. Retorno do serviço   — "faz 30 dias da sua coloração" (service_return)
--   5. Pacote vencendo      — 7 dias antes, se ainda tem sessão (package_reminder)
--
-- Tudo desligado por padrão: cada salão liga o que quer em Configurações →
-- WhatsApp. Nada aqui fala com o WhatsApp direto — tudo entra na mesma fila
-- (whatsapp_outbox), que já cuida da janela 8h–20h no fuso do salão, do teto
-- diário com ramp-up, do ritmo entre mensagens e do circuit breaker.
--
-- Mensagem que a cliente não pediu é a que mais gera bloqueio, e número
-- bloqueado derruba o salão inteiro. Por isso cada tipo tem trava própria
-- (uma vez por ano, uma por ausência, uma por pacote) além das gerais:
-- opt-out (SAIR), teto de 4 mensagens iniciadas por cliente em 7 dias e no
-- máximo 25 de cada tipo por salão por dia.
--
-- PRÉ-REQUISITO: 20261022_whatsapp_automacoes_1_kinds.sql já aplicado.
-- ─────────────────────────────────────────────────────────────────────────


-- ══ 1. Configuração ═══════════════════════════════════════════════════════

alter table public.whatsapp_instances
  add column if not exists send_winback_auto     boolean not null default false,
  add column if not exists winback_days          int     not null default 15,
  add column if not exists winback_campaign_id   uuid references public.campaigns(id) on delete set null,
  add column if not exists send_birthday         boolean not null default false,
  add column if not exists birthday_campaign_id  uuid references public.campaigns(id) on delete set null,
  add column if not exists send_waitlist_open    boolean not null default false,
  add column if not exists send_service_return   boolean not null default false,
  add column if not exists send_package_reminder boolean not null default false;

alter table public.whatsapp_instances
  drop constraint if exists whatsapp_instances_winback_days_check;
alter table public.whatsapp_instances
  add constraint whatsapp_instances_winback_days_check
  check (winback_days between 7 and 180);

-- Retorno por serviço: coloração a cada 30 dias, sobrancelha a cada 15, barba
-- a cada 10. Vazio = o serviço não manda lembrete de retorno.
alter table public.services
  add column if not exists return_days int;

alter table public.services
  drop constraint if exists services_return_days_check;
alter table public.services
  add constraint services_return_days_check
  check (return_days is null or return_days between 5 and 365);


-- ══ 2. Regras compartilhadas ══════════════════════════════════════════════

-- Tipos novos entram no teto de "iniciadas pelo salão". A vaga liberada
-- também conta (ocupa a cota da semana), mas não é barrada por ela — ver
-- whatsapp_avisar_lista_espera.
create or replace function public.whatsapp_kind_iniciada(
  p_kind public.whatsapp_message_kind
) returns boolean
 language sql
 immutable
as $function$
  select p_kind in (
    'booking_receipt', 'thank_you', 'reminder_confirm', 'review_request',
    'winback_no_show', 'winback_cancelled', 'winback_inactive',
    'birthday', 'waitlist_open', 'service_return', 'package_reminder'
  );
$function$;

-- Rodapé do SAIR: sempre nas que a cliente não pediu (aniversário, retorno,
-- pacote entram junto com avaliação e recuperação); nas outras, só na
-- primeira mensagem da vida dela. Vaga liberada fica na regra da primeira:
-- foi ela quem pediu para entrar na lista.
create or replace function public.whatsapp_rodape(
  p_client uuid,
  p_kind public.whatsapp_message_kind
) returns text
 language sql
 stable
 set search_path to 'public'
as $function$
  select case
    when p_kind in ('review_request', 'winback_no_show', 'winback_cancelled', 'winback_inactive',
                    'birthday', 'service_return', 'package_reminder')
      or not exists (select 1 from whatsapp_outbox o where o.client_id = p_client)
    then E'\n\n_Se um dia não quiser mais receber mensagens, é só responder SAIR._'
    else ''
  end;
$function$;

-- "Faz 32 dias", "faz 2 meses": o tempo exato prova que alguém olhou a ficha.
create or replace function public.whatsapp_tempo(p_dias int)
 returns text
 language sql
 immutable
as $function$
  select case
    when p_dias is null then 'um tempo'
    when p_dias <= 1 then 'um dia'
    when p_dias < 45 then p_dias || ' dias'
    when p_dias < 365 then round(p_dias / 30.0)::int || ' meses'
    else 'mais de um ano'
  end;
$function$;

-- Uma das variações do tipo (a do salão tem prioridade sobre a padrão).
create or replace function public.whatsapp_template(
  p_kind public.whatsapp_message_kind,
  p_salon uuid
) returns text
 language sql
 volatile
 set search_path to 'public'
as $function$
  select t.body
  from whatsapp_templates t
  where t.kind = p_kind and t.is_active
    and (t.salon_id = p_salon or t.salon_id is null)
  order by (t.salon_id is null), random()
  limit 1;
$function$;

-- Cupom de uma campanha do salão, só se estiver ativa e dentro das datas.
-- Campanha vencida some do texto em vez de oferecer um desconto que o caixa
-- não vai aceitar.
create or replace function public.whatsapp_cupom(
  p_campaign uuid,
  p_salon uuid,
  p_presente boolean default false
) returns text
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce((
    select case when p_presente
      then E'\n\nDe presente: com o cupom *' || c.name || '* você ganha ' ||
           c.discount_percent || '% de desconto no seu próximo horário 🎁'
      else E'\n\nE olha só: com o cupom *' || c.name || '* você tem ' ||
           c.discount_percent || '% de desconto na próxima visita.'
    end
    from campaigns c
    where c.id = p_campaign and c.salon_id = p_salon and c.is_active
      and (c.starts_on is null or c.starts_on <= current_date)
      and (c.ends_on is null or c.ends_on >= current_date)
  ), '');
$function$;

-- Preenche as variáveis comuns ({cliente} {salao} {link} {rodape}) e as
-- específicas de cada tipo, passadas em p_extra ({"data": "12/11", ...}).
create or replace function public.whatsapp_preencher(
  p_body text,
  p_kind public.whatsapp_message_kind,
  p_salon uuid,
  p_client uuid,
  p_extra jsonb default '{}'::jsonb
) returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_body text := p_body;
  v_cliente text;
  v_salao text;
  v_slug text;
  k text;
  v text;
begin
  if v_body is null then return null; end if;

  select s.name, s.slug into v_salao, v_slug from salons s where s.id = p_salon;
  select nullif(split_part(coalesce(c.full_name, ''), ' ', 1), '') into v_cliente
  from clients c where c.id = p_client;

  for k, v in select * from jsonb_each_text(coalesce(p_extra, '{}'::jsonb)) loop
    v_body := replace(v_body, '{' || k || '}', coalesce(v, ''));
  end loop;

  -- Mesmo fallback dos outros renders: "Oi, tudo bem!" continua uma frase.
  v_body := replace(v_body, '{cliente}', coalesce(v_cliente, 'tudo bem'));
  v_body := replace(v_body, '{salao}',   coalesce(v_salao, ''));
  -- Domínio fixo: o banco não enxerga as variáveis de ambiente do app.
  v_body := replace(v_body, '{link}',
    case when v_slug is null then ''
         else E'\n\nDá pra agendar por aqui: https://zulan.com.br/' || v_slug end);
  v_body := replace(v_body, '{rodape}', whatsapp_rodape(p_client, p_kind));
  return v_body;
end;
$function$;

-- Coloca uma mensagem da cliente na fila, com as travas gerais. Devolve se
-- entrou. p_teto = false só para o que a própria cliente pediu (lista de espera).
create or replace function public.whatsapp_enfileirar_cliente(
  p_salon uuid,
  p_client uuid,
  p_kind public.whatsapp_message_kind,
  p_body text,
  p_teto boolean default true
) returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_phone text;
  v_opt_out boolean;
  v_recentes int;
begin
  if p_body is null then return false; end if;

  if not exists (
    select 1 from whatsapp_instances i
    where i.salon_id = p_salon and i.status = 'connected'
  ) then
    return false;
  end if;

  select normalize_br_phone(c.phone), c.whatsapp_opt_out
    into v_phone, v_opt_out
  from clients c
  where c.id = p_client and c.salon_id = p_salon;
  if v_phone is null or coalesce(v_opt_out, false) then return false; end if;

  if p_teto then
    select count(*) into v_recentes
    from whatsapp_outbox o
    where o.client_id = p_client
      and o.status in ('queued', 'sending', 'sent')
      and whatsapp_kind_iniciada(o.kind)
      and o.created_at > now() - interval '7 days';
    if v_recentes >= 4 then return false; end if;
  end if;

  insert into whatsapp_outbox (salon_id, client_id, kind, phone, body)
  values (p_salon, p_client, p_kind, v_phone, p_body);
  return true;
end;
$function$;

revoke execute on function public.whatsapp_template(public.whatsapp_message_kind, uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_cupom(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.whatsapp_preencher(text, public.whatsapp_message_kind, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.whatsapp_enfileirar_cliente(uuid, uuid, public.whatsapp_message_kind, text, boolean) from public, anon, authenticated;


-- ══ 3. Textos ═════════════════════════════════════════════════════════════
-- Mesmo tom das mensagens atuais (20260731_whatsapp_menos_robo): primeira
-- pessoa do singular, sem "aqui é do salão", sem bloco de campos. Duas ou
-- três variações por tipo — texto idêntico repetido é impressão de robô.
-- O serviço entra sem artigo ("você fez *Coloração*"): "seu Coloração" errava
-- o gênero, e o nome do serviço pode ser qualquer um.
-- O delete deixa o arquivo reaplicável sem duplicar as variações.

delete from public.whatsapp_templates
where salon_id is null
  and kind in ('birthday', 'waitlist_open', 'service_return', 'package_reminder');

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'birthday',
   E'Feliz aniversário, {cliente}! 🎉\nQue seu novo ano seja lindo — e que a gente se veja logo por aqui.{cupom}{link}{rodape}'),
  (null, 'birthday',
   E'{cliente}, hoje é seu dia! 🎂\nParabéns! Desejo tudo de melhor pra você.{cupom}{link}{rodape}'),
  (null, 'birthday',
   E'Parabéns, {cliente}! 🥳\nPassando pra desejar um aniversário cheio de coisa boa.{cupom}{link}{rodape}'),

  (null, 'waitlist_open',
   E'Oi, {cliente}! Abriu um horário no dia {data} às {hora}{com_quem} — você estava na lista de espera 💚\nSe ainda quiser, garante antes que alguém pegue.{link}{rodape}'),
  (null, 'waitlist_open',
   E'{cliente}, boa notícia! Vagou um horário dia {data} às {hora}{com_quem}, o dia que você queria.\nQuem marcar primeiro fica com ele.{link}{rodape}'),

  (null, 'service_return',
   E'Oi, {cliente}! Já faz {tempo} que você fez *{servico}* 💚\nSe quiser manter tudo em dia, separo um horário{com_quem}.{link}{rodape}'),
  (null, 'service_return',
   E'{cliente}, tudo bem?\nFaz {tempo} que você fez *{servico}* — costuma ser a hora de renovar. Quer marcar{com_quem}?{link}{rodape}'),
  (null, 'service_return',
   E'Oi, {cliente}! Passando pra lembrar: faz {tempo} que você fez *{servico}*. Quer que eu reserve um horário{com_quem}?{link}{rodape}'),

  (null, 'package_reminder',
   E'Oi, {cliente}! Seu pacote *{pacote}* vale até {vence} e ainda tem {restam} pra usar 💚\nQuer marcar antes de vencer?{link}{rodape}'),
  (null, 'package_reminder',
   E'{cliente}, tudo bem?\nAinda tem {restam} no seu pacote *{pacote}*, válido até {vence}. Bora aproveitar?{link}{rodape}');


-- ══ 4. Sentimos sua falta (automático) ════════════════════════════════════
-- Mesmos templates e mesma fila da recuperação manual (tela Recuperar), com
-- três cuidados:
--   • Ritmo da própria cliente: com 3+ visitas, o prazo é o maior entre o
--     configurado e 1,25× o intervalo médio dela. Quem corta a cada 45 dias
--     não "sumiu" no dia 15.
--   • Uma por ausência: nenhuma recuperação (nem lembrete de retorno) depois
--     da última visita.
--   • Janela de 7 dias depois do prazo: ligar a opção não dispara para a base
--     inteira de quem sumiu há meses — isso derrubaria o número no 1º dia.
-- Roda de hora em hora e age às 11h no fuso de cada salão.
create or replace function public.whatsapp_enqueue_winback_auto()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_body text;
  v_cupom text;
  v_desc int;
  v_total int := 0;
begin
  for r in
    with visitas as (
      select c.id as client_id,
             c.salon_id,
             c.last_contacted_at,
             i.winback_days,
             i.winback_campaign_id,
             s.timezone,
             max(a.starts_at) as ultima,
             min(a.starts_at) as primeira,
             count(*) as total
      from clients c
      join whatsapp_instances i on i.salon_id = c.salon_id
      join salons s on s.id = c.salon_id
      join appointments a
        on a.client_id = c.id and a.salon_id = c.salon_id and a.status = 'completed'
      where i.status = 'connected'
        and i.send_winback_auto
        and not c.whatsapp_opt_out
        and c.phone is not null
        and extract(hour from (now() at time zone s.timezone)) = 11
      group by c.id, c.salon_id, c.last_contacted_at, i.winback_days, i.winback_campaign_id, s.timezone
    ),
    prazos as (
      select v.*,
             greatest(
               v.winback_days,
               case when v.total >= 3 then
                 ceil(extract(epoch from (v.ultima - v.primeira)) / 86400.0
                      / (v.total - 1) * 1.25)::int
               end
             ) as prazo,
             ((now() at time zone v.timezone)::date
               - (v.ultima at time zone v.timezone)::date) as dias
      from visitas v
    ),
    elegiveis as (
      select p.*,
             row_number() over (partition by p.salon_id order by p.dias) as ordem
      from prazos p
      where p.dias between p.prazo and p.prazo + 7
        -- Já tem horário marcado: não sumiu, só ainda não chegou o dia.
        and not exists (
          select 1 from appointments f
          where f.client_id = p.client_id and f.salon_id = p.salon_id
            and f.status in ('pending', 'confirmed', 'in_progress')
            and f.starts_at > now()
        )
        and not exists (
          select 1 from whatsapp_outbox o
          where o.client_id = p.client_id
            and o.kind in ('winback_no_show', 'winback_cancelled', 'winback_inactive', 'service_return')
            and o.status in ('queued', 'sending', 'sent')
            and o.created_at > p.ultima
        )
        -- Chamado pelo link do WhatsApp (wa.me) em Recuperar também conta.
        and (p.last_contacted_at is null or p.last_contacted_at < now() - interval '21 days')
    )
    select e.client_id, e.salon_id, e.winback_campaign_id
    from elegiveis e
    where e.ordem <= 25
  loop
    -- Cupom só de campanha ativa e dentro das datas (mesma regra do
    -- whatsapp_cupom); sem campanha, o render tira o pedaço do texto.
    v_cupom := null;
    v_desc := null;
    select c.name, c.discount_percent into v_cupom, v_desc
    from campaigns c
    where c.id = r.winback_campaign_id and c.salon_id = r.salon_id and c.is_active
      and (c.starts_on is null or c.starts_on <= current_date)
      and (c.ends_on is null or c.ends_on >= current_date);

    v_body := whatsapp_render_winback('winback_inactive', r.salon_id, r.client_id, v_cupom, v_desc);

    if whatsapp_enfileirar_cliente(r.salon_id, r.client_id, 'winback_inactive', v_body) then
      -- Mesmo efeito do clique manual: o Gestor e a tela Recuperar param de
      -- sugerir chamar quem acabou de ser chamado.
      update clients set last_contacted_at = now() where id = r.client_id;
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$function$;


-- ══ 5. Aniversário ════════════════════════════════════════════════════════
-- Às 9h do dia, no fuso do salão. Só para quem é cliente de verdade (veio
-- pelo menos uma vez no último ano) — mandar parabéns para cadastro antigo
-- que nunca voltou é exatamente o tipo de mensagem que vira denúncia.
-- Nascido em 29/02 recebe em 28/02 nos anos que não são bissextos.
create or replace function public.whatsapp_enqueue_birthdays()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_body text;
  v_total int := 0;
begin
  for r in
    with base as (
      select c.id as client_id, c.salon_id, i.birthday_campaign_id,
             (now() at time zone s.timezone)::date as hoje,
             c.birth_date
      from clients c
      join whatsapp_instances i on i.salon_id = c.salon_id
      join salons s on s.id = c.salon_id
      where i.status = 'connected'
        and i.send_birthday
        and c.birth_date is not null
        and not c.whatsapp_opt_out
        and c.phone is not null
        and extract(hour from (now() at time zone s.timezone)) = 9
    ),
    elegiveis as (
      select b.*,
             row_number() over (partition by b.salon_id order by b.client_id) as ordem
      from base b
      where (
          to_char(b.birth_date, 'MM-DD') = to_char(b.hoje, 'MM-DD')
          or (to_char(b.birth_date, 'MM-DD') = '02-29'
              and to_char(b.hoje, 'MM-DD') = '02-28'
              and to_char(b.hoje + 1, 'MM-DD') = '03-01')
        )
        and exists (
          select 1 from appointments a
          where a.client_id = b.client_id and a.salon_id = b.salon_id
            and a.status = 'completed'
            and a.starts_at > now() - interval '365 days'
        )
        -- Uma vez por ano (folga para não depender do horário exato).
        and not exists (
          select 1 from whatsapp_outbox o
          where o.client_id = b.client_id and o.kind = 'birthday'
            and o.status in ('queued', 'sending', 'sent')
            and o.created_at > now() - interval '300 days'
        )
    )
    select * from elegiveis where ordem <= 25
  loop
    v_body := whatsapp_preencher(
      whatsapp_template('birthday', r.salon_id), 'birthday', r.salon_id, r.client_id,
      jsonb_build_object('cupom', whatsapp_cupom(r.birthday_campaign_id, r.salon_id, true))
    );
    if whatsapp_enfileirar_cliente(r.salon_id, r.client_id, 'birthday', v_body) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$function$;


-- ══ 6. Retorno do serviço ═════════════════════════════════════════════════
-- Às 14h. Para cada cliente, olha o último atendimento de cada serviço que tem
-- "retorno em X dias" e avisa quando o prazo chega (até 3 dias depois — sem
-- disparo retroativo ao ligar). Uma mensagem por cliente por dia, a do serviço
-- mais atrasado; e nunca junto de uma recuperação.
create or replace function public.whatsapp_enqueue_service_returns()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_body text;
  v_total int := 0;
begin
  for r in
    with ultimos as (
      select distinct on (a.client_id, aps.service_id)
             a.client_id, a.salon_id, a.starts_at, a.member_id,
             aps.name as servico, sv.return_days, s.timezone
      from appointments a
      join appointment_services aps on aps.appointment_id = a.id
      join services sv on sv.id = aps.service_id
      join salons s on s.id = a.salon_id
      join whatsapp_instances i on i.salon_id = a.salon_id
      where a.status = 'completed'
        and a.client_id is not null
        and sv.return_days is not null
        and i.status = 'connected'
        and i.send_service_return
        and extract(hour from (now() at time zone s.timezone)) = 14
      order by a.client_id, aps.service_id, a.starts_at desc
    ),
    vencidos as (
      select u.*,
             ((now() at time zone u.timezone)::date
               - (u.starts_at at time zone u.timezone)::date) as dias
      from ultimos u
    ),
    um_por_cliente as (
      select distinct on (v.client_id) v.*
      from vencidos v
      join clients c on c.id = v.client_id
      where v.dias between v.return_days and v.return_days + 3
        and not c.whatsapp_opt_out
        and c.phone is not null
        and not exists (
          select 1 from appointments f
          where f.client_id = v.client_id and f.salon_id = v.salon_id
            and f.status in ('pending', 'confirmed', 'in_progress')
            and f.starts_at > now()
        )
        and not exists (
          select 1 from whatsapp_outbox o
          where o.client_id = v.client_id
            and o.kind in ('service_return', 'winback_no_show', 'winback_cancelled', 'winback_inactive')
            and o.status in ('queued', 'sending', 'sent')
            and o.created_at > v.starts_at
        )
      order by v.client_id, v.dias - v.return_days desc
    ),
    limitados as (
      select x.*, row_number() over (partition by x.salon_id order by x.dias) as ordem
      from um_por_cliente x
    )
    select l.*,
           (select coalesce(m.display_name, p.full_name)
              from salon_members m left join profiles p on p.id = m.profile_id
             where m.id = l.member_id) as profissional
    from limitados l
    where l.ordem <= 25
  loop
    v_body := whatsapp_preencher(
      whatsapp_template('service_return', r.salon_id), 'service_return', r.salon_id, r.client_id,
      jsonb_build_object(
        'servico', r.servico,
        'tempo', whatsapp_tempo(r.dias),
        'com_quem', case when coalesce(r.profissional, '') = '' then ''
                         else ' com ' || split_part(r.profissional, ' ', 1) end
      )
    );
    if whatsapp_enfileirar_cliente(r.salon_id, r.client_id, 'service_return', v_body) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$function$;


-- ══ 7. Pacote vencendo ════════════════════════════════════════════════════
-- Às 16h, 7 dias antes do vencimento, se ainda sobra sessão. Uma vez por
-- pacote: a trava olha os últimos 10 dias, que cobre a janela inteira.
create or replace function public.whatsapp_enqueue_package_reminders()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_body text;
  v_total int := 0;
begin
  for r in
    with pacotes as (
      select cp.id, cp.client_id, cp.salon_id, cp.name, cp.expires_at, s.timezone,
             sum(it.total - it.used) as restam
      from client_packages cp
      join client_package_items it on it.client_package_id = cp.id
      join salons s on s.id = cp.salon_id
      join whatsapp_instances i on i.salon_id = cp.salon_id
      join clients c on c.id = cp.client_id
      where cp.status = 'active'
        and i.status = 'connected'
        and i.send_package_reminder
        and not c.whatsapp_opt_out
        and c.phone is not null
        and extract(hour from (now() at time zone s.timezone)) = 16
        and (cp.expires_at at time zone s.timezone)::date
            = (now() at time zone s.timezone)::date + 7
      group by cp.id, cp.client_id, cp.salon_id, cp.name, cp.expires_at, s.timezone
      having sum(it.total - it.used) > 0
    ),
    elegiveis as (
      select p.*, row_number() over (partition by p.salon_id order by p.expires_at) as ordem
      from pacotes p
      where not exists (
        select 1 from whatsapp_outbox o
        where o.client_id = p.client_id and o.kind = 'package_reminder'
          and o.status in ('queued', 'sending', 'sent')
          and o.created_at > now() - interval '10 days'
      )
    )
    select * from elegiveis where ordem <= 25
  loop
    v_body := whatsapp_preencher(
      whatsapp_template('package_reminder', r.salon_id), 'package_reminder', r.salon_id, r.client_id,
      jsonb_build_object(
        'pacote', r.name,
        'vence', to_char(r.expires_at at time zone r.timezone, 'DD/MM'),
        'restam', r.restam || case when r.restam = 1 then ' sessão' else ' sessões' end
      )
    );
    if whatsapp_enfileirar_cliente(r.salon_id, r.client_id, 'package_reminder', v_body) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$function$;


-- ══ 8. Vaga liberada para a lista de espera ═══════════════════════════════
-- Gatilho próprio (não mexe no whatsapp_on_appointment): quando um horário
-- futuro é cancelado, avisa até 3 pessoas da lista de espera daquele dia —
-- as que entraram primeiro, e só se o profissional bate (ou se ela aceitava
-- qualquer um). Quem marcar primeiro fica com a vaga; a lista continua lá
-- para o salão converter na Agenda.
--
-- Mesma regra de ouro do gatilho do comprovante: WhatsApp é acessório e não
-- pode derrubar o cancelamento. Qualquer erro aqui é engolido.
create or replace function public.whatsapp_avisar_lista_espera()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_tz text;
  v_dia date;
  v_prof text;
  v_body text;
begin
  if not (NEW.status = 'cancelled'
          and OLD.status in ('pending', 'confirmed')
          and NEW.starts_at > now() + interval '2 hours') then
    return NEW;
  end if;

  if not exists (
    select 1 from whatsapp_instances i
    where i.salon_id = NEW.salon_id and i.status = 'connected' and i.send_waitlist_open
  ) then
    return NEW;
  end if;

  select s.timezone into v_tz from salons s where s.id = NEW.salon_id;
  v_dia := (NEW.starts_at at time zone v_tz)::date;

  select coalesce(m.display_name, p.full_name) into v_prof
  from salon_members m left join profiles p on p.id = m.profile_id
  where m.id = NEW.member_id;

  for r in
    select w.client_id, w.member_id
    from appointment_waitlist w
    where w.salon_id = NEW.salon_id
      and w.status = 'waiting'
      and w.preferred_date = v_dia
      and (w.member_id is null or w.member_id = NEW.member_id)
      and w.client_id is distinct from NEW.client_id
      -- Duas desistências na mesma manhã não viram duas mensagens.
      and not exists (
        select 1 from whatsapp_outbox o
        where o.client_id = w.client_id and o.kind = 'waitlist_open'
          and o.status in ('queued', 'sending', 'sent')
          and o.created_at > now() - interval '6 hours'
      )
    order by w.created_at
    limit 3
  loop
    v_body := whatsapp_preencher(
      whatsapp_template('waitlist_open', NEW.salon_id), 'waitlist_open', NEW.salon_id, r.client_id,
      jsonb_build_object(
        'data', to_char(NEW.starts_at at time zone v_tz, 'DD/MM'),
        'hora', to_char(NEW.starts_at at time zone v_tz, 'HH24:MI'),
        -- "com a Bianca" só quando ela pediu essa profissional; quem aceitava
        -- qualquer uma não precisa do nome.
        'com_quem', case when r.member_id is not null and coalesce(v_prof, '') <> ''
                         then ' com ' || split_part(v_prof, ' ', 1) else '' end
      )
    );
    -- p_teto = false: foi ela quem pediu para ser avisada.
    perform whatsapp_enfileirar_cliente(NEW.salon_id, r.client_id, 'waitlist_open', v_body, false);
  end loop;

  return NEW;
exception when others then
  raise warning 'whatsapp_avisar_lista_espera falhou (agendamento %): %', NEW.id, sqlerrm;
  return NEW;
end;
$function$;

drop trigger if exists appointments_whatsapp_lista_espera on public.appointments;
create trigger appointments_whatsapp_lista_espera
  after update of status on public.appointments
  for each row execute function public.whatsapp_avisar_lista_espera();


-- ══ 9. Permissões e agendamentos (pg_cron) ════════════════════════════════

revoke execute on function public.whatsapp_enqueue_winback_auto() from public, anon, authenticated;
revoke execute on function public.whatsapp_enqueue_birthdays() from public, anon, authenticated;
revoke execute on function public.whatsapp_enqueue_service_returns() from public, anon, authenticated;
revoke execute on function public.whatsapp_enqueue_package_reminders() from public, anon, authenticated;
revoke execute on function public.whatsapp_avisar_lista_espera() from public, anon, authenticated;

-- De hora em hora; cada função só age na hora certa do fuso de cada salão.
-- Minutos diferentes para não acordarem todas juntas.
select cron.schedule('whatsapp-birthdays',       '12 * * * *', $$select public.whatsapp_enqueue_birthdays();$$);
select cron.schedule('whatsapp-winback-auto',    '14 * * * *', $$select public.whatsapp_enqueue_winback_auto();$$);
select cron.schedule('whatsapp-service-returns', '16 * * * *', $$select public.whatsapp_enqueue_service_returns();$$);
select cron.schedule('whatsapp-package-reminders', '18 * * * *', $$select public.whatsapp_enqueue_package_reminders();$$);
