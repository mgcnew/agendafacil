-- ─────────────────────────────────────────────────────────────────────────
-- O aviso deixa de ser uma linha de tabela e vira um recado.
--
-- Antes: "Novo agendamento" / "Marcelo · 31/07 14:00". Isso é o registro do
-- banco lido em voz alta. Faltava o serviço, faltava a data em linguagem de
-- gente, e faltava o dado que num salão de três pessoas é o PRIMEIRO que cada
-- uma quer saber: com quem é. Ninguém descobria se o horário era seu sem
-- abrir o painel.
--
-- Três decisões que valem explicação:
--
-- 1. SAÚDE SÓ ATRÁS DE LOGIN. `clients.alert_summary` diz "Gestante",
--    "Tratamento oncológico". Isso na tela bloqueada de um celular em cima do
--    balcão é dado sensível (LGPD art. 11) exposto a quem passar perto — e a
--    pessoa de quem é o dado não autorizou aquilo. O push avisa que EXISTE
--    algo a conferir; o sino, que só abre logado, diz o que é. Daí o
--    parâmetro `p_health`.
--
-- 2. O TRIGGER PASSA A SER DEFERIDO. `book_appointment` insere o agendamento
--    e SÓ DEPOIS chama `_appt_fill`, que grava `appointment_services`. Um
--    AFTER INSERT normal dispara no fim do insert — antes dos serviços
--    existirem — e o recado sairia dizendo "marcou Atendimento" para sempre,
--    sem ninguém entender por quê. Um constraint trigger deferido roda no
--    commit, quando a transação já está inteira.
--
-- 3. CONFIRMAÇÃO SÓ QUANDO NÃO FUI EU. A cliente responder SIM no WhatsApp é
--    notícia. A profissional mudar o status no próprio painel não é — ela
--    acabou de fazer isso. `auth.uid() is null` separa os dois: o webhook
--    entra por service_role, o painel entra logado.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Data em linguagem de gente ───────────────────────────────────────────
/**
 * "hoje às 14:00", "amanhã às 14:00", "sexta, 05/08 às 14:00", "12/09 às 14:00".
 *
 * `to_char(..., 'TMDay')` não serve: o lc_time do banco é en_US e devolve
 * "Friday". Daí o array na mão.
 *
 * Dia da semana só dentro da semana que vem — passou disso, "sexta" confunde
 * mais do que ajuda e a data seca é mais honesta.
 */
create or replace function public.data_amigavel(
  p_ts timestamptz,
  p_tz text default 'America/Sao_Paulo'
) returns text
 language sql
 stable
 set search_path to 'public'
as $function$
  with l as (
    select
      (p_ts at time zone coalesce(p_tz, 'America/Sao_Paulo'))::date as d,
      (current_timestamp at time zone coalesce(p_tz, 'America/Sao_Paulo'))::date as hoje,
      to_char(p_ts at time zone coalesce(p_tz, 'America/Sao_Paulo'), 'HH24:MI') as hora,
      to_char(p_ts at time zone coalesce(p_tz, 'America/Sao_Paulo'), 'DD/MM') as ddmm,
      (array['segunda','terça','quarta','quinta','sexta','sábado','domingo'])[
        extract(isodow from p_ts at time zone coalesce(p_tz, 'America/Sao_Paulo'))::int
      ] as semana
  )
  select case
    when d = hoje     then 'hoje às ' || hora
    when d = hoje + 1 then 'amanhã às ' || hora
    when d > hoje and d < hoje + 7 then semana || ', ' || ddmm || ' às ' || hora
    else ddmm || ' às ' || hora
  end
  from l;
$function$;

-- ── O recado ─────────────────────────────────────────────────────────────
/**
 * Título e corpo do aviso, num lugar só — o sino e o push leem daqui, então
 * não têm como divergir com o tempo.
 *
 * `p_recipient` liga a parte pessoal: saudação pelo primeiro nome e "com
 * você" em vez de "com Ana". Sem ele sai a versão neutra, que é a do push
 * (um texto para todos os aparelhos, sem uma consulta por token).
 *
 * `p_health` liga o detalhe da ficha. Só onde há login.
 */
create or replace function public.appointment_notice(
  p_appointment uuid,
  p_event text,
  p_recipient uuid default null,
  p_health boolean default false
) returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_quem text;      -- "você" ou o nome da profissional
  v_saud text := '';
  v_title text;
  v_body text;
  v_extra text := '';
  v_espera int;
begin
  select
    btrim(coalesce(c.full_name, 'Cliente')) as cliente,
    c.alert_summary as ficha,
    btrim(coalesce(pm.full_name, '')) as prof,
    m.profile_id as prof_id,
    a.starts_at, a.member_id, a.salon_id, a.service_mode, a.home_address,
    s.timezone,
    coalesce(
      (select string_agg(x.name, ' + ' order by x.name)
         from appointment_services x where x.appointment_id = a.id),
      'Atendimento'
    ) as servicos
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  left join salon_members m on m.id = a.member_id
  left join profiles pm on pm.id = m.profile_id
  where a.id = p_appointment;

  if r is null then return null; end if;

  -- "com você" só para quem é do horário; para os demais, o nome de quem é.
  v_quem := case
    when p_recipient is not null and p_recipient = r.prof_id then 'você'
    when nullif(r.prof, '') is not null then split_part(r.prof, ' ', 1)
    else null
  end;

  if p_recipient is not null then
    select 'Olá, ' || split_part(btrim(p.full_name), ' ', 1) || '! '
      into v_saud
    from profiles p where p.id = p_recipient and nullif(btrim(p.full_name), '') is not null;
    v_saud := coalesce(v_saud, '');
  end if;

  if p_event = 'created' then
    v_title := 'Novo agendamento';
    if p_recipient is not null then
      v_body := v_saud || r.cliente || ' marcou ' || r.servicos ||
                ' para ' || data_amigavel(r.starts_at, r.timezone) ||
                coalesce(', com ' || v_quem, '') || '.';
    else
      v_body := r.cliente || ' · ' || r.servicos || ' · ' ||
                data_amigavel(r.starts_at, r.timezone) ||
                coalesce(' · com ' || v_quem, '');
    end if;

  elsif p_event = 'cancelled' then
    v_title := 'Agendamento cancelado';

    -- Quem pode entrar no lugar. É a única coisa acionável num cancelamento,
    -- e hoje o sino não contava (só o push contava).
    select count(*) into v_espera
    from appointment_waitlist w
    where w.salon_id = r.salon_id
      and w.status = 'waiting'
      and w.preferred_date = (r.starts_at at time zone r.timezone)::date
      and (w.member_id is null or w.member_id = r.member_id);

    if p_recipient is not null then
      v_body := v_saud || r.cliente || ' desmarcou ' || r.servicos ||
                ' de ' || data_amigavel(r.starts_at, r.timezone) || '.';
      if v_espera > 0 then
        v_body := v_body || E'\n🔁 ' ||
          case when v_espera = 1 then '1 pessoa está' else v_espera || ' pessoas estão' end ||
          ' na lista de espera desse dia.';
      end if;
    else
      v_body := r.cliente || ' · ' || r.servicos || ' · ' ||
                data_amigavel(r.starts_at, r.timezone) ||
                case when v_espera > 0 then ' · ' || v_espera || ' na lista de espera' else '' end;
    end if;

  elsif p_event = 'reminder' then
    -- A véspera é justamente quando a profissional se prepara: é o aviso que
    -- mais precisa dizer o serviço, o endereço e a ficha, e era o mais seco
    -- de todos.
    v_title := 'Amanhã você tem horário';
    if p_recipient is not null then
      v_body := v_saud || r.cliente || ' tem ' || r.servicos || ' ' ||
                data_amigavel(r.starts_at, r.timezone) ||
                coalesce(', com ' || v_quem, '') || '.';
    else
      v_body := r.cliente || ' · ' || r.servicos || ' · ' ||
                data_amigavel(r.starts_at, r.timezone);
    end if;

  elsif p_event = 'confirmed' then
    v_title := 'Cliente confirmou';
    if p_recipient is not null then
      v_body := v_saud || r.cliente || ' confirmou o horário de ' ||
                data_amigavel(r.starts_at, r.timezone) || '.';
    else
      v_body := r.cliente || ' confirmou · ' || data_amigavel(r.starts_at, r.timezone);
    end if;

  else
    return null;
  end if;

  -- Domicílio muda o que a profissional precisa fazer antes da hora, então
  -- entra no recado em vez de ficar só no card da agenda.
  if r.service_mode = 'home' then
    v_extra := v_extra || case when p_recipient is not null
      then E'\n🏠 Em domicílio: ' || coalesce(r.home_address, 'endereço na ficha')
      else ' · em domicílio' end;
  end if;

  -- A ficha. Com login, o que é; sem login, só que existe.
  if nullif(btrim(coalesce(r.ficha, '')), '') is not null then
    v_extra := v_extra || case
      when p_health then E'\n⚠️ Ficha: ' || r.ficha || ' — confira os cuidados antes.'
      when p_recipient is not null then E'\n⚠️ Tem observações na ficha — confira antes.'
      else ' ⚠️ tem observações na ficha'
    end;
  end if;

  return jsonb_build_object('title', v_title, 'body', v_body || v_extra);
end;
$function$;

revoke execute on function public.appointment_notice(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.appointment_notice(uuid, text, uuid, boolean) to authenticated;
-- service_role NÃO herda de authenticated (conferido em pg_auth_members: as
-- três roles do Supabase são irmãs, não aninhadas). Sem esta linha o `revoke
-- from public` acima tira o acesso da Edge Function do push e ele para de
-- sair — mesma armadilha que derrubou a edição de clientes por dois dias.
grant execute on function public.appointment_notice(uuid, text, uuid, boolean) to service_role;

-- ── O trigger ────────────────────────────────────────────────────────────
create or replace function public.notify_appointment_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event text;
  v_secret text;
begin
  if TG_OP = 'INSERT' then
    if NEW.status in ('cancelled', 'no_show', 'completed') then return NEW; end if;
    v_event := 'created';

  elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    if NEW.status = 'cancelled' then
      v_event := 'cancelled';
    elsif NEW.status = 'confirmed' and auth.uid() is null then
      -- Veio de fora do painel: a cliente respondeu SIM no WhatsApp. Se
      -- fosse a profissional clicando, avisá-la do que ela acabou de fazer
      -- seria ruído — e ruído no sino faz o sino inteiro ser ignorado.
      v_event := 'confirmed';
    else
      return NEW;
    end if;

  else
    return NEW;
  end if;

  -- Sino: uma linha por membro ativo, porque lido/não-lido é individual — e é
  -- o que permite chamar cada um pelo nome.
  --
  -- Confirmação foge da regra: só interessa a quem tem o horário. Mandar pro
  -- salão inteiro encheria o sino de aviso que ninguém precisa fazer nada a
  -- respeito, e sino cheio de ruído é sino que ninguém abre. Cai no dono
  -- quando a profissional não tem login.
  insert into notifications (salon_id, recipient_id, type, title, body, data)
  select NEW.salon_id, m.profile_id, 'appointment_' || v_event,
         n.aviso->>'title', n.aviso->>'body',
         jsonb_build_object('appointment_id', NEW.id, 'event', v_event, 'starts_at', NEW.starts_at)
  from salon_members m
  cross join lateral (select appointment_notice(NEW.id, v_event, m.profile_id, true) as aviso) n
  where m.salon_id = NEW.salon_id and m.is_active and m.profile_id is not null
    and n.aviso is not null
    and (
      v_event <> 'confirmed'
      or m.id = NEW.member_id
      or (m.role = 'owner' and not exists (
            select 1 from salon_members d
            where d.id = NEW.member_id and d.is_active and d.profile_id is not null))
    );

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';

  if v_secret is not null then
    perform net.http_post(
      url := 'https://lllibsgqpvgmpurzmram.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      body := jsonb_build_object('event', v_event, 'appointment_id', NEW.id, 'salon_id', NEW.salon_id)
    );
  end if;

  return NEW;

-- Aviso não pode derrubar agendamento. Antes desta migração o corpo era uma
-- concatenação trivial e nunca falhava; agora ele lê meia dúzia de tabelas, e
-- um erro aqui abortaria o commit da cliente que estava marcando.
exception when others then
  raise warning 'notify_appointment_event falhou (agendamento %): %', NEW.id, sqlerrm;
  return NEW;
end;
$function$;

revoke execute on function public.notify_appointment_event() from anon, authenticated;

-- Deferido: `appointment_services` só existe no fim da transação (ver o
-- cabeçalho). Constraint trigger não aceita lista de colunas, então o filtro
-- de status mora no corpo da função.
drop trigger if exists appointments_notify_push on public.appointments;
create constraint trigger appointments_notify_push
  after insert or update on public.appointments
  deferrable initially deferred
  for each row execute function public.notify_appointment_event();

-- ── O lembrete de véspera passa pelo mesmo texto ─────────────────────────
-- Ele é por cron, não por trigger, então tem função própria — mas o corpo do
-- recado agora sai do mesmo lugar que os outros três. Sem isso ele ficaria
-- sendo o único aviso seco do painel.
create or replace function public.send_appointment_reminders()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_secret text;
  v_aviso jsonb;
  r record;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';

  for r in
    select a.id as appointment_id, a.salon_id, a.starts_at, m.profile_id
    from appointments a
    join salon_members m on m.id = a.member_id
    where a.reminder_sent_at is null
      and a.status not in ('cancelled', 'no_show', 'completed')
      and m.profile_id is not null
      and (a.starts_at at time zone 'America/Sao_Paulo')::date
          = ((now() at time zone 'America/Sao_Paulo')::date + 1)
  loop
    v_aviso := appointment_notice(r.appointment_id, 'reminder', r.profile_id, true);

    if v_aviso is not null then
      insert into notifications (salon_id, recipient_id, type, title, body, data)
      values (
        r.salon_id, r.profile_id, 'appointment_reminder',
        v_aviso->>'title', v_aviso->>'body',
        jsonb_build_object('appointment_id', r.appointment_id, 'event', 'reminder', 'starts_at', r.starts_at)
      );
    end if;

    if v_secret is not null then
      perform net.http_post(
        url := 'https://lllibsgqpvgmpurzmram.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
        body := jsonb_build_object(
          'event', 'reminder', 'appointment_id', r.appointment_id,
          'salon_id', r.salon_id, 'profile_id', r.profile_id
        )
      );
    end if;

    update appointments set reminder_sent_at = now() where id = r.appointment_id;
  end loop;
end;
$function$;

revoke execute on function public.send_appointment_reminders() from anon, authenticated;
