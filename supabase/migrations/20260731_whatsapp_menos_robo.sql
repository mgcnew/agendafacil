-- ─────────────────────────────────────────────────────────────────────────
-- As mensagens paravam de soar como pessoa por cinco motivos, e o texto era
-- só o quinto.
--
-- 1. O RODAPÉ DO SAIR EM 100% DAS MENSAGENS. Ninguém encerra um agradecimento
--    com aviso de descadastro. Estava até no comprovante de um horário que a
--    cliente tinha ACABADO de marcar. Agora ele sai só na primeira mensagem
--    que aquela pessoa recebe na vida — onde ele de fato ensina algo — e nas
--    que o salão manda sem ela ter pedido (avaliação e recuperação). O SAIR
--    continua sendo honrado sempre, tenha sido anunciado ou não: quem digita
--    é atendido, e é isso que importa pro anti-ban. Anunciar 500 vezes não
--    protege mais; só denuncia o robô.
--
-- 2. "AQUI É DO {salao}" em 6 templates. Fala de URA. No WhatsApp o nome do
--    remetente já é o salão — repetir só acontece em mensagem automática.
--
-- 3. NINGUÉM ASSINAVA. A cliente tem vínculo com a Bianca, não com o "Studio
--    Aurora", e o nome dela estava no banco sem ser usado em nenhuma mensagem.
--    Vira `{assinatura}`, uma linha "— Bianca" no fim. Assinatura em vez de
--    "aqui é a Bianca" resolve dois problemas de uma vez: não precisa acertar
--    o artigo (a/o) de um nome cujo gênero não sabemos, e some sozinha quando
--    a profissional não tem nome cadastrado.
--
-- 4. PLURAL CORPORATIVO. "Anotamos", "Esperamos que tenha amado o resultado".
--    Cadeira de salão é uma pessoa, não um departamento.
--
-- 5. BLOCO DE CAMPOS ROTULADOS onde não cabia. No comprovante e no lembrete
--    ele está certo — é o que a cliente printa e consulta. No agradecimento e
--    na recuperação era formulário fingindo ser conversa.
--
-- Menor, mas real: `thank_you` dizia "obrigado", no masculino, num negócio
-- onde quem manda quase sempre é mulher.
-- ─────────────────────────────────────────────────────────────────────────

-- ── O rodapé, agora com regra ────────────────────────────────────────────
/**
 * Um lugar só, porque os dois renderizadores precisam do mesmo texto e do
 * mesmo critério.
 *
 * Chamado ANTES do insert na outbox (ver `whatsapp_enqueue`), então "não
 * existe nenhuma linha desta cliente" é exatamente "esta é a primeira".
 *
 * VOLTAR não entra: quem nunca saiu não precisa saber como voltar, e o ack do
 * SAIR já ensina isso na hora certa.
 */
create or replace function public.whatsapp_rodape(
  p_client uuid,
  p_kind public.whatsapp_message_kind
) returns text
 language sql
 stable
 set search_path to 'public'
as $function$
  select case
    when p_kind in ('review_request', 'winback_no_show', 'winback_cancelled', 'winback_inactive')
      or not exists (select 1 from whatsapp_outbox o where o.client_id = p_client)
    then E'\n\n_Se um dia não quiser mais receber mensagens, é só responder SAIR._'
    else ''
  end;
$function$;

-- ── Render: assina e sabe quando calar o rodapé ──────────────────────────
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
  v_body := replace(v_body, '{taxa}',        r.taxa);
  v_body := replace(v_body, '{total}',       r.total);
  v_body := replace(v_body, '{regra}',       r.regra);
  v_body := replace(v_body, '{profissional}', coalesce(nullif(r.profissional, ''), 'a gente'));
  v_body := replace(v_body, '{assinatura}',  v_assina);
  v_body := replace(v_body, '{rodape}',      whatsapp_rodape(r.client_id, p_kind));

  return v_body;
end;
$function$;

-- ── Os textos ────────────────────────────────────────────────────────────
-- Só os padrões (salon_id null). Se um salão personalizou o dele, a escolha
-- dele continua valendo.
delete from public.whatsapp_templates where salon_id is null;

-- Comprovante: aqui o bloco de campos É o certo. É a mensagem que a cliente
-- printa e volta pra consultar; conversa fiada atrapalharia.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'booking_receipt',
   E'Oi, {cliente}! Seu horário está marcado 💚\n\n📅 {data} às {hora}\n💇 {servico}\n\nSe precisar mudar alguma coisa, é só me chamar por aqui.{assinatura}{rodape}'),
  (null, 'booking_receipt',
   E'{cliente}, anotei aqui! ✨\n\n📅 {data} · {hora}\n💇 {servico}\n\nTe espero!{assinatura}{rodape}'),
  (null, 'booking_receipt',
   E'Prontinho, {cliente}! Seu horário no *{salao}*:\n\n📅 {data} às {hora}\n💇 {servico}\n\nQualquer imprevisto, me avisa que a gente remarca.{assinatura}{rodape}');

-- Agradecimento: nenhum campo rotulado. Se é pra soar como pessoa, tem que
-- parecer o que uma pessoa digitaria depois de trabalhar em alguém.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'thank_you',
   E'Oi, {cliente}! Adorei te atender hoje 💚\nEspero que você tenha amado o {servico}.\n\nQualquer coisa nesses dias, me chama por aqui.{instagram}{assinatura}{rodape}'),
  (null, 'thank_you',
   E'{cliente}, que bom ter você aqui hoje! ✨\nSe ficar qualquer dúvida sobre como cuidar, é só me perguntar.{instagram}{assinatura}{rodape}'),
  (null, 'thank_you',
   E'Oi, {cliente}! Passando só pra dizer que foi ótimo te atender 💚\nTe espero na próxima!{instagram}{assinatura}{rodape}');

-- Lembrete: operacional, então o bloco fica. Mas o pedido de confirmação
-- ganha o motivo — "pra eu me organizar" é o que faz alguém responder.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'reminder_confirm',
   E'Oi, {cliente}! Passando pra lembrar do seu horário amanhã 💚\n\n📅 {data} às {hora}\n💇 {servico}\n\nConsegue vir? Responde *SIM* ou *NÃO* que eu já me organizo aqui.{assinatura}{rodape}'),
  (null, 'reminder_confirm',
   E'{cliente}, tudo bem? Seu horário é amanhã:\n\n📅 {data} · {hora}\n💇 {servico}\n\nMe confirma? *SIM* se estiver de pé, *NÃO* se não der.{assinatura}{rodape}'),
  (null, 'reminder_confirm',
   E'Oi, {cliente}! Amanhã tem {servico} marcado, às {hora} ✨\nResponde *SIM* ou *NÃO* pra eu saber se te espero?{assinatura}{rodape}');

-- Avaliação: o pedido tem que dizer por que ajuda, senão é só trabalho.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'review_request',
   E'Oi, {cliente}! Ontem foi muito bom te atender 💚\n\nSe sobrar um minutinho, você conta como foi? Ajuda bastante quem está procurando um salão aqui perto:\n{google}{assinatura}{rodape}'),
  (null, 'review_request',
   E'{cliente}, tudo bem?\nFiquei feliz de te ver ontem ✨ Se puder deixar sua opinião registrada, leva menos de um minuto e faz muita diferença:\n{google}{assinatura}{rodape}'),
  (null, 'review_request',
   E'Oi, {cliente}! Espero que tenha gostado do resultado 💚\nSe quiser contar como foi, é só clicar aqui:\n{google}{assinatura}{rodape}');

-- Domicílio: "não está confirmado" continua em negrito. A diferença entre
-- "recebi" e "está marcado" é o recurso inteiro.
insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_request',
   E'Oi, {cliente}! Recebi seu pedido de atendimento em domicílio 💚\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\nAinda *não está confirmado*: vou conferir a agenda e a distância e já te mando o valor do deslocamento ({regra}).{assinatura}{rodape}'),
  (null, 'home_request',
   E'{cliente}, seu pedido chegou! ✨\n\n📋 {servico}\n📅 {data} às {hora}\n📍 {endereco}\n\nFalta só eu confirmar. O deslocamento é {regra} — te mando o valor exato daqui a pouco.{assinatura}{rodape}');

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'home_confirmed',
   E'Confirmado, {cliente}! 💚\nVou até você no dia {data} às {hora}.\n\n📋 {servico}\n📍 {endereco}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nAté lá!{assinatura}{rodape}'),
  (null, 'home_confirmed',
   E'Oi, {cliente}! Tudo certo pro seu atendimento em casa ✨\n\n📅 {data} às {hora}\n📋 {servico}\n📍 {endereco}\n🚗 Deslocamento: {taxa}\n💰 Total: {total}\n\nQualquer coisa é só me chamar!{assinatura}{rodape}');

-- ── Recuperação ──────────────────────────────────────────────────────────
-- Renderizador próprio (parte de cliente, não de agendamento). Ganha o mesmo
-- `{rodape}` — aqui ele SEMPRE aparece: é mensagem que o salão manda sem a
-- cliente ter pedido nada, e é justamente onde a saída fácil evita o
-- "Bloquear" que derruba o número.
--
-- Não leva assinatura: `{com_quem}` já cita a profissional no meio da frase,
-- e assinar de novo com o mesmo nome soaria estranho.
create or replace function public.whatsapp_render_winback(
  p_kind public.whatsapp_message_kind,
  p_salon_id uuid,
  p_client_id uuid,
  p_cupom text default null,
  p_desconto int default null
) returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_body text; v_cliente text; v_salao text; v_slug text; v_tz text;
  v_servico text; v_com_quem text := ''; v_tempo text := 'um tempo';
  v_cupom text := ''; v_link text := ''; v_dias int; v_status appointment_status;
  v_appt record;
begin
  select t.body into v_body
  from whatsapp_templates t
  where t.kind = p_kind and t.is_active
    and (t.salon_id = p_salon_id or t.salon_id is null)
  order by (t.salon_id is null), random()
  limit 1;
  if v_body is null then return null; end if;

  select s.name, s.slug, s.timezone into v_salao, v_slug, v_tz
  from salons s where s.id = p_salon_id;

  select split_part(btrim(coalesce(c.full_name, 'tudo bem')), ' ', 1) into v_cliente
  from clients c where c.id = p_client_id;

  v_status := case p_kind
    when 'winback_no_show' then 'no_show'::appointment_status
    when 'winback_cancelled' then 'cancelled'::appointment_status
    else 'completed'::appointment_status
  end;

  select a.id,
         to_char(a.starts_at at time zone v_tz, 'DD/MM') as data,
         to_char(a.starts_at at time zone v_tz, 'HH24:MI') as hora,
         coalesce(m.display_name, p.full_name) as profissional,
         greatest(extract(day from (now() - a.starts_at))::int, 0) as dias
    into v_appt
  from appointments a
  left join salon_members m on m.id = a.member_id
  left join profiles p on p.id = m.profile_id
  where a.salon_id = p_salon_id
    and a.client_id = p_client_id
    and a.status = v_status
  order by a.starts_at desc
  limit 1;

  if v_appt.id is not null then
    select string_agg(aps.name, ' + ' order by aps.name) into v_servico
    from appointment_services aps
    where aps.appointment_id = v_appt.id;

    v_dias := v_appt.dias;

    if coalesce(v_appt.profissional, '') <> '' then
      v_com_quem := ' com ' || split_part(v_appt.profissional, ' ', 1);
    end if;
  end if;

  v_servico := coalesce(nullif(v_servico, ''), 'atendimento');

  if v_dias is not null then
    if v_dias <= 1 then      v_tempo := 'um dia';
    elsif v_dias < 45 then   v_tempo := v_dias || ' dias';
    elsif v_dias < 365 then  v_tempo := round(v_dias / 30.0)::int || ' meses';
    else                     v_tempo := 'mais de um ano';
    end if;
  end if;

  if p_cupom is not null and p_desconto is not null then
    v_cupom := E'\n\nE olha só: com o cupom *' || p_cupom || '* você tem ' ||
               p_desconto || '% de desconto na próxima visita.';
  end if;

  if v_slug is not null then
    v_link := E'\n\nSe preferir, dá pra agendar por aqui: https://zulan.com.br/' || v_slug;
  end if;

  v_body := replace(v_body, '{cliente}',  v_cliente);
  v_body := replace(v_body, '{salao}',    v_salao);
  v_body := replace(v_body, '{data}',     coalesce(v_appt.data, 'sua última visita'));
  v_body := replace(v_body, '{hora}',     coalesce(v_appt.hora, ''));
  v_body := replace(v_body, '{servico}',  v_servico);
  v_body := replace(v_body, '{com_quem}', v_com_quem);
  v_body := replace(v_body, '{tempo}',    v_tempo);
  v_body := replace(v_body, '{cupom}',    v_cupom);
  v_body := replace(v_body, '{link}',     v_link);
  v_body := replace(v_body, '{rodape}',   whatsapp_rodape(p_client_id, p_kind));

  return v_body;
end;
$function$;

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'winback_no_show',
   E'Oi, {cliente}! Senti sua falta no dia {data} 💚\nSem problema nenhum — quando quiser, eu remarco seu {servico}{com_quem}.{cupom}{link}{rodape}'),
  (null, 'winback_no_show',
   E'{cliente}, tudo bem?\nSeu {servico} de {data} ficou em aberto por aqui.\n\nMe diz um dia que seja bom pra você que eu já separo.{cupom}{link}{rodape}'),
  (null, 'winback_no_show',
   E'Oi, {cliente}! Você tinha horário dia {data} às {hora} ({servico}) e acabou não dando pra vir — acontece! 😉\n\nQuer que eu remarque{com_quem}?{cupom}{link}{rodape}');

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'winback_cancelled',
   E'Oi, {cliente}! Aquele horário de {data} que você desmarcou ficou pendente — bora escolher uma data nova?{cupom}{link}{rodape}'),
  (null, 'winback_cancelled',
   E'{cliente}, tudo certo?\nSeu {servico} de {data} foi cancelado e você ainda não remarcou.\n\nSe quiser, é só me dizer o melhor dia.{cupom}{link}{rodape}'),
  (null, 'winback_cancelled',
   E'Oi, {cliente}! Vi aqui que seu horário de {data} foi cancelado.\nJá quer deixar outro marcado{com_quem}?{cupom}{link}{rodape}');

insert into public.whatsapp_templates (salon_id, kind, body) values
  (null, 'winback_inactive',
   E'Oi, {cliente}! Faz {tempo} desde seu último {servico} aqui 😊\nJá tá na hora, né? Quer marcar{com_quem}?{cupom}{link}{rodape}'),
  (null, 'winback_inactive',
   E'{cliente}, que saudade de você por aqui! 💚\nSua última visita foi em {data}. Que tal marcar um horário?{cupom}{link}{rodape}'),
  (null, 'winback_inactive',
   E'Oi, {cliente}! Faz {tempo} que a gente não se vê. Separo um horário pro seu {servico}{com_quem}?{cupom}{link}{rodape}');
