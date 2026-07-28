-- ─────────────────────────────────────────────────────────────────────────
-- WhatsApp transacional — fila de saída (outbox) + camada anti-ban.
--
-- Desenho: NADA envia direto. Trigger e cron só ENFILEIRAM; um worker externo
-- (Edge Function chamada por pg_cron) drena a fila. Fila em vez de disparo
-- direto porque WhatsApp exige o que disparo direto não dá:
--   · retry    — Evolution fora do ar por 2min não pode perder a mensagem
--   · ritmo    — mandar em rajada é o padrão que faz o WhatsApp banir
--   · dedupe   — jamais mandar o mesmo comprovante duas vezes
--   · auditoria— suporte precisa responder "essa cliente recebeu?"
--
-- Uma instância Evolution POR SALÃO: o cliente recebe do número que ele já
-- conhece (mais confiança, menos bloqueio) e um número banido derruba só
-- aquele salão, não a base inteira.
--
-- O envio em si é agnóstico de provedor — a fila guarda texto pronto e o
-- worker escolhe o driver. Trocar Evolution → Meta Cloud API depois é mexer
-- só no worker, nada aqui muda.
-- ─────────────────────────────────────────────────────────────────────────

create type public.whatsapp_instance_status as enum (
  'disconnected',  -- nunca conectou ou caiu
  'connecting',    -- QR code gerado, aguardando leitura
  'connected',     -- operante
  'paused'         -- circuit breaker abriu ou o dono desligou
);

create type public.whatsapp_message_kind as enum (
  'booking_receipt',  -- fase 1: comprovante logo após agendar
  'thank_you',        -- fase 1: agradecimento ao concluir atendimento
  'reminder_confirm', -- fase 2: "confirma amanhã?" (exige webhook de entrada)
  'review_request'    -- fase 2: pedido de avaliação
);

create type public.whatsapp_outbox_status as enum (
  'queued',   -- aguardando janela/ritmo
  'sending',  -- worker pegou (lock)
  'sent',
  'failed',   -- estourou as tentativas
  'skipped'   -- opt-out, sem telefone, teto de frequência, agendamento cancelado
);

-- ── Instância por salão ──────────────────────────────────────────────────
-- Guarda o vínculo com a Evolution e TODO o estado anti-ban do número.
create table public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references public.salons(id) on delete cascade,

  -- Nome da instância na Evolution. Derivado do slug, estável.
  instance_name text not null unique,
  status public.whatsapp_instance_status not null default 'disconnected',
  phone_number text,                 -- número conectado, só p/ exibir no painel
  connected_at timestamptz,

  -- Ramp-up: número novo não sai mandando no volume máximo. A permissão
  -- diária cresce ao longo de ~2 semanas a partir da primeira conexão.
  ramp_started_at timestamptz,
  daily_cap int not null default 300 check (daily_cap > 0),

  -- Ritmo: worker só envia depois deste instante. Reescrito a cada envio com
  -- um intervalo aleatório (jitter) — mata o padrão de rajada.
  next_send_at timestamptz,

  -- Circuit breaker: N falhas seguidas pausa a instância e avisa o dono.
  -- Falha isolada em vez de epidemia.
  failure_count int not null default 0,
  paused_at timestamptz,
  paused_reason text,
  last_error text,

  -- Quais mensagens o salão quer. Fase 1 liga as duas de mão única.
  send_booking_receipt boolean not null default true,
  send_thank_you boolean not null default true,
  send_reminder_confirm boolean not null default false,
  send_review_request boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_instances_status_idx on public.whatsapp_instances(status);

-- ── Fila de saída ────────────────────────────────────────────────────────
create table public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,

  kind public.whatsapp_message_kind not null,
  phone text not null,               -- E.164 normalizado no enfileiramento
  body text not null,                -- texto já renderizado

  status public.whatsapp_outbox_status not null default 'queued',
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  provider_message_id text,
  skip_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedupe forte: um agendamento nunca gera duas vezes a mesma mensagem, não
-- importa quantas vezes o trigger rode ou o cron repita.
create unique index whatsapp_outbox_dedupe_idx
  on public.whatsapp_outbox(appointment_id, kind)
  where appointment_id is not null;

-- Índice do worker: pega o que está pronto pra sair, mais antigo primeiro.
create index whatsapp_outbox_ready_idx
  on public.whatsapp_outbox(scheduled_for)
  where status = 'queued';

create index whatsapp_outbox_salon_sent_idx
  on public.whatsapp_outbox(salon_id, sent_at)
  where status = 'sent';

-- ── Opt-out do cliente ───────────────────────────────────────────────────
-- "Responda SAIR para não receber" é o item anti-ban de maior retorno: dá à
-- pessoa incomodada um caminho que NÃO é o botão Bloquear — e bloqueio é o
-- sinal que mais pesa na decisão de banir o número.
alter table public.clients
  add column if not exists whatsapp_opt_out boolean not null default false,
  add column if not exists whatsapp_opt_out_at timestamptz;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.whatsapp_instances enable row level security;
alter table public.whatsapp_outbox enable row level security;

-- Dono/equipe enxerga a instância do próprio salão. O worker roda com
-- service_role, que ignora RLS — por isso não há policy de escrita ampla.
create policy whatsapp_instances_select_own on public.whatsapp_instances
  for select using (
    exists (
      select 1 from public.salon_members m
      where m.salon_id = whatsapp_instances.salon_id
        and m.profile_id = auth.uid()
    )
  );

create policy whatsapp_instances_update_own on public.whatsapp_instances
  for update using (
    exists (
      select 1 from public.salon_members m
      where m.salon_id = whatsapp_instances.salon_id
        and m.profile_id = auth.uid()
    )
  );

-- Histórico é leitura pra equipe (suporte: "a cliente recebeu?"). Escrita é
-- exclusiva do worker/triggers.
create policy whatsapp_outbox_select_own on public.whatsapp_outbox
  for select using (
    exists (
      select 1 from public.salon_members m
      where m.salon_id = whatsapp_outbox.salon_id
        and m.profile_id = auth.uid()
    )
  );

-- ── Permissão diária (ramp-up) ───────────────────────────────────────────
-- Número que mandava 5/dia e passa a mandar 200 é anômalo mesmo com todos os
-- destinatários quentes — o SALTO conta tanto quanto o destino. Sobe devagar.
create or replace function public.whatsapp_daily_allowance(
  p_ramp_started_at timestamptz,
  p_daily_cap int
) returns int
 language sql
 immutable
as $function$
  select case
    when p_ramp_started_at is null then 20
    when now() < p_ramp_started_at + interval '3 days'  then least(20,  p_daily_cap)
    when now() < p_ramp_started_at + interval '7 days'  then least(40,  p_daily_cap)
    when now() < p_ramp_started_at + interval '14 days' then least(80,  p_daily_cap)
    else p_daily_cap
  end;
$function$;

-- ── Claim: o coração da camada anti-ban ──────────────────────────────────
-- O worker não escolhe o que mandar — ele PEDE, e esta função decide. Toda
-- regra de ritmo vive aqui, num lugar só, testável e à prova de corrida
-- (skip locked). Devolve no máximo 1 mensagem por salão por chamada: envio
-- serializado por instância, nunca em paralelo.
create or replace function public.whatsapp_claim_next(p_max int default 20)
 returns setof public.whatsapp_outbox
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return query
  update whatsapp_outbox o
  set status = 'sending',
      attempts = o.attempts + 1,
      updated_at = now()
  where o.id in (
    -- DISTINCT ON = no máximo uma mensagem por salão nesta rodada.
    select distinct on (x.salon_id) x.id
    from (
      select o2.id, o2.salon_id, o2.scheduled_for
      from whatsapp_outbox o2
      join whatsapp_instances i on i.salon_id = o2.salon_id
      join salons s on s.id = o2.salon_id
      where o2.status = 'queued'
        and o2.scheduled_for <= now()
        -- instância operante
        and i.status = 'connected'
        and i.paused_at is null
        -- ritmo: respeita o jitter definido no envio anterior
        and (i.next_send_at is null or i.next_send_at <= now())
        -- janela de silêncio: só 8h–20h no fuso do salão. Ninguém denuncia
        -- o que chegou em hora civilizada.
        and extract(hour from (now() at time zone s.timezone)) between 8 and 19
        -- teto diário com ramp-up
        and (
          select count(*) from whatsapp_outbox d
          where d.salon_id = o2.salon_id
            and d.status = 'sent'
            and d.sent_at >= (now() at time zone s.timezone)::date at time zone s.timezone
        ) < whatsapp_daily_allowance(i.ramp_started_at, i.daily_cap)
        -- serialização: nada sai enquanto houver mensagem em voo nesse salão
        and not exists (
          select 1 from whatsapp_outbox b
          where b.salon_id = o2.salon_id and b.status = 'sending'
        )
      order by o2.scheduled_for
      limit greatest(p_max, 1) * 5
    ) x
    order by x.salon_id, x.scheduled_for
  )
  -- Recheca sob o lock da linha: se duas execuções do worker se
  -- sobrepuserem, a segunda vê o status já alterado e não reenvia.
  and o.status = 'queued'
  returning o.*;
end;
$function$;

revoke execute on function public.whatsapp_claim_next(int) from anon, authenticated;

-- ── Resultado do envio ───────────────────────────────────────────────────
-- Worker reporta aqui. Concentra o efeito colateral: jitter do próximo envio,
-- contador do breaker e pausa automática.
create or replace function public.whatsapp_mark_result(
  p_id uuid,
  p_ok boolean,
  p_provider_message_id text default null,
  p_error text default null
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon_id uuid;
  v_attempts int;
begin
  select salon_id, attempts into v_salon_id, v_attempts
  from whatsapp_outbox where id = p_id;
  if v_salon_id is null then return; end if;

  if p_ok then
    update whatsapp_outbox
    set status = 'sent', sent_at = now(), provider_message_id = p_provider_message_id,
        last_error = null, updated_at = now()
    where id = p_id;

    -- Ritmo humano: próximo envio deste salão só daqui a 8–25s (aleatório).
    update whatsapp_instances
    set next_send_at = now() + make_interval(secs => 8 + random() * 17),
        failure_count = 0, last_error = null, updated_at = now()
    where salon_id = v_salon_id;
  else
    -- 4 tentativas com espera crescente; depois desiste.
    if v_attempts >= 4 then
      update whatsapp_outbox
      set status = 'failed', last_error = p_error, updated_at = now()
      where id = p_id;
    else
      update whatsapp_outbox
      set status = 'queued', last_error = p_error,
          scheduled_for = now() + make_interval(mins => v_attempts * 5),
          updated_at = now()
      where id = p_id;
    end if;

    -- Circuit breaker: 5 falhas seguidas = número provavelmente com problema.
    -- Pausa e deixa o dono saber, em vez de insistir e piorar a reputação.
    update whatsapp_instances
    set failure_count = failure_count + 1,
        last_error = p_error,
        next_send_at = now() + interval '2 minutes',
        status = case when failure_count + 1 >= 5 then 'paused'::whatsapp_instance_status else status end,
        paused_at = case when failure_count + 1 >= 5 then now() else paused_at end,
        paused_reason = case when failure_count + 1 >= 5 then 'falhas_consecutivas' else paused_reason end,
        updated_at = now()
    where salon_id = v_salon_id;
  end if;
end;
$function$;

revoke execute on function public.whatsapp_mark_result(uuid, boolean, text, text) from anon, authenticated;
