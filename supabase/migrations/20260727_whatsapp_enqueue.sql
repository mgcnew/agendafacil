-- ─────────────────────────────────────────────────────────────────────────
-- WhatsApp — normalização de telefone, templates e enfileiramento.
--
-- Enfileira no banco (trigger) e não no app pelo mesmo motivo do push: um
-- agendamento nasce por caminhos diferentes (book_appointment público,
-- create_staff_appointment, update de status na Agenda). No banco pega todos
-- de uma vez, na fonte da verdade.
--
-- Fase 1: só mensagens de mão única — comprovante ao agendar e agradecimento
-- ao concluir. Sem webhook de entrada, risco baixo.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Normalização BR → E.164 ──────────────────────────────────────────────
-- O 9º dígito é a maior fonte de erro: base antiga tem celular gravado como
-- (11) 8765-4321 (10 dígitos) e o WhatsApp só aceita com o 9 na frente.
-- Retorna null quando não dá pra confiar — melhor não mandar do que mandar
-- pro número errado.
create or replace function public.normalize_br_phone(p_raw text)
 returns text
 language plpgsql
 immutable
as $function$
declare
  d text;
  ddd text;
  numero text;
begin
  if p_raw is null then return null; end if;
  d := regexp_replace(p_raw, '\D', '', 'g');
  if d = '' then return null; end if;

  -- Tira o código do país se já veio
  if length(d) in (12, 13) and left(d, 2) = '55' then
    d := substr(d, 3);
  end if;

  if length(d) not in (10, 11) then return null; end if;

  ddd := left(d, 2);
  numero := substr(d, 3);

  -- DDD válido no Brasil vai de 11 a 99
  if ddd::int < 11 then return null; end if;

  if length(numero) = 8 then
    -- 8 dígitos: celular antigo (começa em 6–9) ganha o 9; fixo não tem
    -- WhatsApp, então descarta.
    if left(numero, 1) in ('6','7','8','9') then
      numero := '9' || numero;
    else
      return null;
    end if;
  end if;

  -- Celular atual sempre começa com 9
  if left(numero, 1) <> '9' then return null; end if;

  return '55' || ddd || numero;
end;
$function$;

-- ── Templates ────────────────────────────────────────────────────────────
-- Variações por tipo: mandar o MESMO texto 500x é fingerprint de robô. O
-- worker sorteia uma. salon_id null = padrão global; com salon_id = o salão
-- personalizou.
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons(id) on delete cascade,
  kind public.whatsapp_message_kind not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index whatsapp_templates_lookup_idx
  on public.whatsapp_templates(kind, salon_id) where is_active;

alter table public.whatsapp_templates enable row level security;

create policy whatsapp_templates_read on public.whatsapp_templates
  for select using (
    salon_id is null or exists (
      select 1 from public.salon_members m
      where m.salon_id = whatsapp_templates.salon_id and m.profile_id = auth.uid()
    )
  );

create policy whatsapp_templates_write on public.whatsapp_templates
  for all using (
    salon_id is not null and exists (
      select 1 from public.salon_members m
      where m.salon_id = whatsapp_templates.salon_id and m.profile_id = auth.uid()
    )
  );

-- Padrões. Variáveis: {cliente} {salao} {data} {hora} {servico}
-- Toda mensagem termina com a saída fácil — é o item anti-ban de maior
-- retorno: converte quem se incomodou em opt-out silencioso, em vez de um
-- "Bloquear" (que é o sinal que de fato derruba o número).
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'booking_receipt',
   E'Oi, {cliente}! 💚\nSeu horário no *{salao}* está marcado:\n\n📅 {data} às {hora}\n💇 {servico}\n\nQualquer coisa, é só chamar por aqui.\n\n_Responda SAIR para não receber mais mensagens._'),
  (null, 'booking_receipt',
   E'{cliente}, tudo certo! ✨\nAgendamento confirmado no *{salao}*:\n\n📅 {data} · {hora}\n💇 {servico}\n\nAté lá!\n\n_Responda SAIR para não receber mais mensagens._'),
  (null, 'booking_receipt',
   E'Olá, {cliente}! Aqui é do *{salao}*.\nAnotamos seu horário:\n\n📅 {data} às {hora}\n💇 {servico}\n\nSe precisar remarcar, é só falar com a gente.\n\n_Responda SAIR para não receber mais mensagens._'),

  (null, 'thank_you',
   E'{cliente}, obrigado pela visita! 💚\nFoi um prazer te atender no *{salao}*.\n\nEsperamos você de novo em breve!\n\n_Responda SAIR para não receber mais mensagens._'),
  (null, 'thank_you',
   E'Obrigado por escolher o *{salao}*, {cliente}! ✨\nEsperamos que tenha amado o resultado.\n\nAté a próxima!\n\n_Responda SAIR para não receber mais mensagens._'),
  (null, 'thank_you',
   E'Oi, {cliente}! Passando pra agradecer sua visita ao *{salao}* hoje. 💚\n\nQualquer coisa, estamos por aqui!\n\n_Responda SAIR para não receber mais mensagens._');

-- ── Renderização ─────────────────────────────────────────────────────────
-- Guarda o texto JÁ renderizado na fila: o suporte precisa ver exatamente o
-- que foi enviado, não um template que pode ter mudado depois.
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
begin
  -- Preferência pelo template do salão; cai no global. Sorteia a variação.
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
    to_char(a.starts_at at time zone s.timezone, 'HH24:MI') as hora
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  where a.id = p_appointment_id;

  if r is null then return null; end if;

  -- Serviços do agendamento (pode ter mais de um). Usa o nome gravado em
  -- appointment_services, não o da tabela services: é o snapshot do que foi
  -- vendido, e service_id pode ser null (serviço avulso ou já excluído).
  select string_agg(aps.name, ' + ' order by aps.name) into v_servico
  from appointment_services aps
  where aps.appointment_id = p_appointment_id;

  v_body := replace(v_body, '{cliente}', split_part(r.cliente, ' ', 1));
  v_body := replace(v_body, '{salao}',   r.salao);
  v_body := replace(v_body, '{data}',    r.data);
  v_body := replace(v_body, '{hora}',    r.hora);
  v_body := replace(v_body, '{servico}', coalesce(v_servico, 'Atendimento'));

  return v_body;
end;
$function$;

-- ── Enfileiramento ───────────────────────────────────────────────────────
-- Um ponto único de entrada na fila, com todas as travas de elegibilidade.
-- Silencioso por design: sem instância, sem telefone ou com opt-out, não
-- enfileira — não é erro, é o comportamento certo.
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
  -- transacional que seja. Quem recebe demais bloqueia.
  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = v_appt.client_id
    and o.status in ('sent', 'queued', 'sending')
    and o.created_at > now() - interval '7 days';
  if v_recentes >= 4 then return; end if;

  v_body := whatsapp_render(p_kind, p_appointment_id);
  if v_body is null then return; end if;

  insert into whatsapp_outbox (salon_id, client_id, appointment_id, kind, phone, body, scheduled_for)
  values (v_appt.salon_id, v_appt.client_id, p_appointment_id, p_kind, v_phone, v_body, now() + p_delay)
  on conflict (appointment_id, kind) where appointment_id is not null do nothing;
end;
$function$;

revoke execute on function public.whatsapp_enqueue(uuid, public.whatsapp_message_kind, interval) from anon, authenticated;

-- ── Triggers ─────────────────────────────────────────────────────────────
create or replace function public.whatsapp_on_appointment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if TG_OP = 'INSERT' then
    -- Comprovante logo após agendar. 30s de atraso: dá tempo de a equipe
    -- corrigir um erro de digitação antes de a mensagem sair.
    if NEW.status not in ('cancelled', 'no_show', 'completed') then
      perform whatsapp_enqueue(NEW.id, 'booking_receipt', interval '30 seconds');
    end if;

  elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    if NEW.status = 'completed' then
      -- Agradecimento 20min depois: mensagem que chega enquanto a cliente
      -- ainda está pagando parece robô.
      perform whatsapp_enqueue(NEW.id, 'thank_you', interval '20 minutes');

    elsif NEW.status in ('cancelled', 'no_show') then
      -- Cancelou? O que ainda não saiu não deve sair.
      update whatsapp_outbox
      set status = 'skipped', skip_reason = 'agendamento_' || NEW.status, updated_at = now()
      where appointment_id = NEW.id and status = 'queued';
    end if;
  end if;

  return NEW;
end;
$function$;

create trigger appointments_whatsapp
  after insert or update of status on public.appointments
  for each row execute function public.whatsapp_on_appointment();

revoke execute on function public.whatsapp_on_appointment() from anon, authenticated;
