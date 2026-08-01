-- ─────────────────────────────────────────────────────────────────────────
-- O deslocamento vira pergunta, não fato consumado.
--
-- O fluxo confirmava o atendimento no mesmo instante em que revelava o preço:
-- a profissional digitava o km, o sistema mudava o status para `confirmed` e a
-- cliente recebia "Confirmado! 💚 Total: R$ 190". Ela nunca disse sim ao valor.
--
-- Quem acha caro não responde "achei caro" — some. E o custo desse sumiço cai
-- inteiro no salão: o horário fica marcado, os minutos de ida e volta ficam
-- bloqueados, e a profissional só descobre no dia. É o pior dos dois mundos,
-- porque o recurso de bloquear o trajeto (20260731_domicilio_deslocamento)
-- funcionou exatamente como deveria — reservou tempo para uma viagem que não
-- vai acontecer.
--
-- Agora a mensagem do valor é um orçamento: mostra serviço, deslocamento e
-- total, e termina numa pergunta. SIM confirma, NÃO cancela. O horário fica
-- guardado enquanto isso, porque perder a vaga durante a própria pergunta
-- seria punir quem foi consultada.
--
-- SEM WHATSAPP CONECTADO, NADA DISSO EXISTE — e é aqui que o desenho ingênuo
-- quebra. `whatsapp_enqueue` é silencioso de propósito: sem instância, com
-- opt-out ou no teto semanal, ele volta sem enfileirar nada. Se o status
-- ficasse "aguardando resposta" nesse caso, o atendimento entraria num limbo
-- do qual ninguém sai: a cliente nunca recebeu pergunta nenhuma. Então a
-- confirmação automática continua existindo, e passa a ser exatamente a
-- exceção certa: só quando a pergunta comprovadamente NÃO saiu.
--
-- Junto vai `{valor}` — o preço do serviço em si. Faltava nas duas mensagens
-- de domicílio, e sem ele a cliente via "Total: R$ 190" sem conseguir separar
-- o que é trabalho do que é viagem. É o número que faz o deslocamento parecer
-- razoável (ou não), e escondê-lo era o que mais empurrava para o silêncio.
-- ─────────────────────────────────────────────────────────────────────────

-- Quando a pergunta saiu. É o que separa "pendente porque ninguém olhou" de
-- "pendente porque a cliente está decidindo" — dois estados que a agenda
-- mostrava idênticos.
alter table public.appointments
  add column if not exists home_quote_at timestamptz;

-- ── Render: o preço do serviço, separado da viagem ───────────────────────
-- `total_price` já inclui a taxa (ver set_appointment_travel), então o serviço
-- é a subtração. greatest() porque um estorno malfeito não pode virar número
-- negativo na mensagem da cliente.
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
  v_assina text;
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
    a.client_id,
    s.name as salao,
    to_char(a.starts_at at time zone s.timezone, 'DD/MM') as data,
    to_char(a.starts_at at time zone s.timezone, 'HH24:MI') as hora,
    instagram_handle(s.instagram) as insta,
    nullif(btrim(coalesce(s.google_business, '')), '') as google,
    coalesce(a.home_address, '') as endereco,
    -- brl() e não to_char: o lc_numeric do banco é en_US e sairia "R$ 70.00"
    -- na mensagem da cliente (ver 20260730_atendimento_domicilio_5_brl.sql).
    brl(a.travel_fee) as taxa,
    brl(a.total_price) as total,
    brl(greatest(coalesce(a.total_price, 0) - coalesce(a.travel_fee, 0), 0)) as valor,
    brl(s.home_first_km_fee) || ' o primeiro km + ' ||
      brl(s.home_extra_km_fee) || ' por km adicional' as regra,
    -- display_name antes do nome do perfil: é o nome que ela escolheu pra
    -- aparecer, e é assim que a cliente a conhece.
    split_part(btrim(coalesce(m.display_name, pm.full_name, '')), ' ', 1) as profissional
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  left join salon_members m on m.id = a.member_id
  left join profiles pm on pm.id = m.profile_id
  where a.id = p_appointment_id;

  if r is null then return null; end if;

  if p_kind = 'review_request' and r.google is null then return null; end if;

  select string_agg(aps.name, ' + ' order by aps.name) into v_servico
  from appointment_services aps
  where aps.appointment_id = p_appointment_id;

  v_insta := case
    when r.insta is null then ''
    else E'\n\n📸 Dá uma olhada nos trabalhos: instagram.com/' || r.insta
  end;

  -- Some sozinha quando não há nome — a mensagem continua fazendo sentido.
  v_assina := case
    when nullif(r.profissional, '') is null then ''
    else E'\n\n— ' || r.profissional
  end;

  v_body := replace(v_body, '{cliente}',     split_part(r.cliente, ' ', 1));
  v_body := replace(v_body, '{salao}',       r.salao);
  v_body := replace(v_body, '{data}',        r.data);
  v_body := replace(v_body, '{hora}',        r.hora);
  v_body := replace(v_body, '{servico}',     coalesce(v_servico, 'Atendimento'));
  v_body := replace(v_body, '{instagram}',   v_insta);
  v_body := replace(v_body, '{google}',      coalesce(r.google, ''));
  v_body := replace(v_body, '{endereco}',    r.endereco);
  v_body := replace(v_body, '{valor}',       r.valor);
  v_body := replace(v_body, '{taxa}',        r.taxa);
  v_body := replace(v_body, '{total}',       r.total);
  v_body := replace(v_body, '{regra}',       r.regra);
  v_body := replace(v_body, '{profissional}', coalesce(nullif(r.profissional, ''), 'a gente'));
  v_body := replace(v_body, '{assinatura}',  v_assina);
  v_body := replace(v_body, '{rodape}',      whatsapp_rodape(r.client_id, p_kind));

  return v_body;
end;
$function$;

-- ── Os três textos do domicílio ──────────────────────────────────────────
-- Escopo estreito no delete: só os padrões dos tipos que mudam. Salão que
-- personalizou o texto dele continua com o dele — e é por isso que
-- `{valor}` entra como variável nova em vez de substituir `{total}`:
-- template antigo que não cita `{valor}` segue renderizando igual.
delete from public.whatsapp_templates
where salon_id is null and kind in ('home_request', 'home_confirmed');

-- 1. O pedido chegou. Agora avisa que vai HAVER uma pergunta: sem isso, o
--    "responda SIM" do orçamento chega do nada.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_request',
   E'Oi, {cliente}! Recebi seu pedido de atendimento em domicílio 💚\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\nAinda *não está confirmado*: vou conferir a agenda e a distância e já te mando o valor do deslocamento ({regra}) pra você me dizer se pode ser.{assinatura}{rodape}'),
  (null, 'home_request',
   E'{cliente}, seu pedido chegou! ✨\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\nO deslocamento é {regra} — vou medir a distância daí e te mando o valor fechado. Aí você confirma se ficou bom.{assinatura}{rodape}');

-- 2. O orçamento. Termina em pergunta, e a pergunta é a última linha de
--    propósito: é o que sobra na prévia da notificação do celular.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_quote',
   E'Oi, {cliente}! Fiz as contas do seu atendimento em casa 💚\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\n💇 Serviço: {valor}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nPosso confirmar? Responde *SIM* que eu guardo o horário, ou *NÃO* se preferir deixar pra outro dia — sem problema nenhum.{assinatura}{rodape}'),
  (null, 'home_quote',
   E'{cliente}, consegui fechar o valor do seu atendimento em domicílio ✨\n\n📅 {data} às {hora}\n📋 {servico}\n📍 {endereco}\n\n💇 Serviço: {valor}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nSeu horário está guardado, mas ainda *não confirmado*. Me responde *SIM* pra fechar, ou *NÃO* se não der.{assinatura}{rodape}');

-- 3. Depois do sim. Agora o nome do tipo é verdade.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_confirmed',
   E'Combinado, {cliente}! 💚\nVou até você no dia {data} às {hora}.\n\n📋 {servico}\n📍 {endereco}\n💇 Serviço: {valor}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nAté lá!{assinatura}{rodape}'),
  (null, 'home_confirmed',
   E'Fechado, {cliente}! ✨ Seu atendimento em casa está confirmado.\n\n📅 {data} às {hora}\n📋 {servico}\n📍 {endereco}\n💇 Serviço: {valor}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nQualquer coisa é só me chamar!{assinatura}{rodape}');

-- ── Fechar o valor virou perguntar o valor ───────────────────────────────
/**
 * Mesma assinatura de antes de propósito: acrescentar parâmetro criaria
 * sobrecarga e a chamada do painel ficaria ambígua no PostgREST.
 *
 * Devolve `aguardando` para a tela saber qual das duas coisas aconteceu —
 * a pergunta saiu (fica pendente) ou não havia como perguntar (confirma
 * direto, como antes).
 */
create or replace function public.set_appointment_travel(
  p_appointment uuid,
  p_km numeric,
  p_confirm boolean default true,
  p_minutes integer default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid; v_client uuid; v_member uuid; v_old_fee numeric; v_fee numeric;
  v_avisar boolean; v_starts timestamptz; v_ends timestamptz; v_nome text;
  v_ja_perguntou timestamptz; v_perguntou boolean := false;
  v_status appointment_status;
begin
  select a.salon_id, a.client_id, a.member_id, a.travel_fee, (a.travel_km is null),
         a.starts_at, a.ends_at, coalesce(c.full_name, 'Cliente'), a.home_quote_at
    into v_salon, v_client, v_member, v_old_fee, v_avisar, v_starts, v_ends,
         v_nome, v_ja_perguntou
  from appointments a
  left join clients c on c.id = a.client_id
  where a.id = p_appointment;

  if v_salon is null then raise exception 'appointment_not_found'; end if;
  if not has_permission(v_salon, 'appointments.manage') then raise exception 'forbidden'; end if;
  if p_km is null or p_km < 0 then raise exception 'km_invalido'; end if;
  if p_minutes is not null and (p_minutes < 0 or p_minutes > 480) then
    raise exception 'minutos_invalidos';
  end if;

  if exists (select 1 from cash_transactions where appointment_id = p_appointment and type = 'income') then
    raise exception 'already_finalized';
  end if;

  v_fee := home_service_fee(v_salon, p_km);

  -- Os valores primeiro: o orçamento é renderizado a partir desta linha, então
  -- ela precisa estar certa antes de a mensagem ser montada.
  update appointments set
    service_mode = 'home',
    travel_km = p_km,
    travel_fee = v_fee,
    travel_minutes = coalesce(p_minutes, travel_minutes),
    total_price = greatest(coalesce(total_price, 0) - coalesce(v_old_fee, 0) + v_fee, 0),
    updated_at = now()
  where id = p_appointment;

  -- O que faz a próxima vez ser instantânea.
  if v_client is not null then
    update clients set distance_km = p_km where id = v_client;
  end if;

  -- Refaz do zero: corrigir de 30 pra 20 minutos precisa ENCOLHER o bloqueio,
  -- não acrescentar um segundo por cima do primeiro.
  --
  -- O trajeto é reservado mesmo com o valor ainda em aberto: quem foi
  -- consultada não pode perder a vaga durante a própria pergunta. Se ela
  -- disser não, o trigger de cancelamento apaga tudo junto.
  delete from schedule_blocks where appointment_id = p_appointment;

  if coalesce(p_minutes, 0) > 0 then
    insert into schedule_blocks (salon_id, member_id, starts_at, ends_at, reason, appointment_id)
    values
      (v_salon, v_member, v_starts - make_interval(mins => p_minutes), v_starts,
       'Ida — ' || v_nome, p_appointment),
      (v_salon, v_member, v_ends, v_ends + make_interval(mins => p_minutes),
       'Volta — ' || v_nome, p_appointment);
  end if;

  -- ── A pergunta ─────────────────────────────────────────────────────────
  -- Só quando o valor era desconhecido pra cliente: corrigir o km de um
  -- atendimento já orçado não pergunta duas vezes.
  if v_avisar and p_confirm then
    perform whatsapp_enqueue(p_appointment, 'home_quote', interval '10 seconds');

    -- whatsapp_enqueue é silencioso: pergunta se a mensagem existe de fato,
    -- em vez de supor que existe. Ver o cabeçalho — é daqui que sai a
    -- diferença entre "aguardando resposta" e limbo.
    select exists (
      select 1 from whatsapp_outbox
      where appointment_id = p_appointment and kind = 'home_quote'
        and status in ('queued', 'sending', 'sent')
    ) into v_perguntou;

    if v_perguntou then
      update appointments set home_quote_at = now() where id = p_appointment;
    end if;
  end if;

  -- Confirmação automática, agora como exceção: só quando não há pergunta a
  -- caminho nem pergunta feita antes. Sem WhatsApp conectado o comportamento
  -- é o de sempre, e quem combinou o valor por telefone não fica travado.
  if p_confirm and not v_perguntou and v_ja_perguntou is null then
    update appointments set status = 'confirmed'
    where id = p_appointment and status = 'pending';
  end if;

  select a.status, a.home_quote_at into v_status, v_ja_perguntou
  from appointments a where a.id = p_appointment;

  return jsonb_build_object(
    'travel_km', p_km,
    'travel_fee', v_fee,
    'travel_minutes', p_minutes,
    'aguardando', v_status = 'pending' and v_ja_perguntou is not null
  );
end;
$function$;

revoke execute on function public.set_appointment_travel(uuid, numeric, boolean, integer) from public, anon;
grant execute on function public.set_appointment_travel(uuid, numeric, boolean, integer) to authenticated;

-- ── Mais jeitos de dizer sim e não ───────────────────────────────────────
/**
 * A lista era curta demais para uma pergunta sobre dinheiro. "Sim" e "ok"
 * cobrem quem responde lembrete; quem recebe um orçamento responde "pode
 * vir", "fechado", "ta caro", "deixa pra próxima".
 *
 * Continua sendo casamento da frase INTEIRA depois de normalizar (ver
 * whatsapp_normalize_text), então "não sei se pode vir" não vira confirmação.
 * O que não casar cai em 'unknown' e fica só registrado — e é para isso que
 * existe o botão de confirmar na mão, no painel.
 */
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
               'sim vou', 'claro', 'positivo', 'ta certo', 'ta bom', 'tudo certo',
               -- resposta a orçamento
               'pode vir', 'pode sim', 'sim pode', 'sim pode vir', 'pode vir sim',
               'pode marcar', 'pode confirmar', 'sim pode confirmar', 'sim confirmo',
               'confirma sim', 'pode ser', 'combinado', 'fechado', 'fechou',
               'aceito', 'de acordo', 'concordo', 'ta otimo', 'otimo', 'perfeito',
               'maravilha', 'show', 'ta ok', 'ok pode vir', 'sim claro',
               'claro que sim', 'sim por favor', 'por favor sim', 'sim obrigada',
               'sim obrigado', 'ta bom sim', 'sim ta bom', 'ta otimo sim')
      then 'confirm'
    when t in ('nao', 'n', '2', 'nao vou', 'nao posso', 'nao consigo',
               'cancelar', 'cancela', 'desmarcar', 'negativo', 'nao da',
               -- resposta a orçamento
               'nao quero', 'nao vai dar', 'nao vai rolar', 'nao vou poder',
               'nao da nao', 'melhor nao', 'prefiro nao', 'deixa pra proxima',
               'fica pra proxima', 'vou deixar pra proxima', 'nao obrigada',
               'nao obrigado', 'ta caro', 'esta caro', 'achei caro', 'muito caro',
               'caro demais', 'ficou caro', 'nao posso agora', 'desisti',
               'nao precisa')
      then 'decline'
    else 'unknown'
  end
  from (select public.whatsapp_normalize_text(p_body) as t) x;
$function$;

revoke execute on function public.whatsapp_classify(text) from public, anon, authenticated;

-- ── SIM e NÃO agora respondem a duas perguntas diferentes ────────────────
/**
 * Mudanças em relação a 20260730_whatsapp_sino_sem_conversa.sql:
 *
 *  · o SIM/NÃO passa a casar também com `home_quote`, e a busca devolve QUAL
 *    das duas perguntas está sendo respondida — as respostas são diferentes;
 *
 *  · janela de 7 dias para o orçamento, contra 48h do lembrete: o lembrete é
 *    da véspera e envelhece rápido; o orçamento pode ser de um atendimento
 *    daqui a duas semanas, e quem responde no dia seguinte está respondendo
 *    aquilo mesmo;
 *
 *  · o agendamento precisa estar vivo. Antes, um SIM para um horário já
 *    cancelado gerava o ack "está confirmado!" enquanto o update não mexia em
 *    nada — a mensagem mentia e ninguém via.
 */
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
  v_kind whatsapp_message_kind;
  v_body text;
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

  -- ── Responder à pergunta mais recente ──────────────────────────────────
  -- Uma consulta só sobre os dois tipos, ordenada por envio: quem tem um
  -- orçamento em aberto e recebe o lembrete de outro horário responde ao
  -- lembrete, que é o que acabou de chegar no celular dela.
  if v_intent in ('confirm', 'decline') and v_client_id is not null then
    select o.appointment_id, o.kind into v_appt_id, v_kind
    from whatsapp_outbox o
    join appointments a on a.id = o.appointment_id
    where o.salon_id = v_salon_id
      and o.phone = v_phone
      and o.status = 'sent'
      and o.appointment_id is not null
      and a.status in ('pending', 'confirmed')
      and (
        (o.kind = 'reminder_confirm' and o.sent_at > now() - interval '48 hours')
        or (o.kind = 'home_quote' and o.sent_at > now() - interval '7 days'
            and a.status = 'pending')
      )
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

      if v_kind = 'home_quote' then
        -- Passa pelo template pra repetir endereço e valores: é a mensagem
        -- que ela vai printar, e o orçamento já rolou pra cima na conversa.
        v_body := whatsapp_render('home_confirmed', v_appt_id);

        perform whatsapp_reply(
          v_salon_id, v_client_id, v_appt_id, 'home_confirmed',
          coalesce(
            v_body,
            'Combinado! Seu atendimento em casa de ' || v_quando ||
            ' está confirmado. Até lá! 💚'
          ),
          v_phone
        );

        -- Vai pro sino: a profissional bloqueou ida e volta na agenda dela e
        -- estava esperando esta resposta. Sem isso ela precisa ficar abrindo
        -- a conversa pra saber se a viagem é real.
        perform whatsapp_notify_salon(
          v_salon_id, v_appt_id,
          'Cliente aceitou o deslocamento',
          coalesce(v_client_name, 'Cliente') ||
          ' confirmou o atendimento em casa de ' || v_quando,
          'appointment_confirmed'
        );
      else
        perform whatsapp_reply(
          v_salon_id, v_client_id, v_appt_id, 'confirm_ack',
          'Show! Seu horário de ' || v_quando || ' está confirmado. Até lá! 💚',
          v_phone
        );
      end if;
    else
      update appointments set status = 'cancelled'
      where id = v_appt_id and status in ('pending', 'confirmed');

      if v_kind = 'home_quote' then
        -- Sem "que pena": ela recusou um preço, não faltou a um compromisso.
        -- A porta de volta é a parte útil da mensagem.
        perform whatsapp_reply(
          v_salon_id, v_client_id, v_appt_id, 'decline_ack',
          'Sem problema, ' ||
          coalesce(nullif(split_part(coalesce(v_client_name, ''), ' ', 1), ''), 'tudo bem') ||
          '! Cancelei o atendimento de ' || v_quando ||
          '. Se quiser vir aqui no salão ou tentar outro dia, é só me chamar 💚',
          v_phone
        );

        perform whatsapp_notify_salon(
          v_salon_id, v_appt_id,
          'Cliente recusou o deslocamento',
          coalesce(v_client_name, 'Cliente') || ' não quis o valor do domicílio de ' ||
          v_quando || '. O horário e o trajeto foram liberados.',
          'whatsapp_cancelled'
        );
      else
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
    end if;

    update whatsapp_inbox
    set acted = true, appointment_id = v_appt_id
    where id = v_inbox_id;

    return jsonb_build_object('ok', true, 'intent', v_intent,
                              'appointment_id', v_appt_id, 'kind', v_kind);
  end if;

  -- Fim da linha: conversa normal ("Blz", "Já", "Bom dia"), ou um
  -- confirm/decline sem pergunta recente pra casar. Fica registrado na
  -- whatsapp_inbox e NADA vai pro sino — quem precisa ler isso já tem a
  -- conversa aberta no WhatsApp do próprio salão.
  return jsonb_build_object('ok', true, 'intent', v_intent, 'acted', false);
end;
$function$;

revoke execute on function public.whatsapp_handle_inbound(text, text, text, text) from public, anon, authenticated;
