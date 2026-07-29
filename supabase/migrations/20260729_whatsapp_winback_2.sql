-- ─────────────────────────────────────────────────────────────────────────
-- Recuperar clientes — enviar de verdade, em vez de abrir o WhatsApp Web.
--
-- Até aqui o botão "Chamar" montava um link wa.me: o dono saía do painel,
-- caía numa conversa com o texto pronto e apertava enviar. Funciona, mas
-- cobra um preço alto — sai do número do salão só se ele estiver logado no
-- aparelho certo, some do histórico (ninguém sabe quem já foi chamado) e o
-- texto era literalmente o mesmo para todo mundo do mesmo balde.
--
-- Agora entra na MESMA fila das mensagens transacionais, o que não é detalhe:
-- é o que faz recuperação herdar de graça a janela de silêncio (8h–20h no
-- fuso do salão), o teto diário com ramp-up, o ritmo com jitter, o circuit
-- breaker e o opt-out. Recuperação é a mensagem com maior risco de queixa —
-- o destinatário não pediu nada, ao contrário do comprovante — e por isso é
-- justamente a que mais precisa dessas travas.
--
-- O que NÃO muda: quem dispara continua sendo o clique do dono, um cliente
-- por vez. Nada aqui envia sozinho, e não existe "chamar todos".
--
-- Personalização: cada mensagem cita a data real, o serviço real e o
-- profissional real daquela pessoa. É o que separa "mensagem pra mim" de
-- "disparo em massa" — e, na prática, o que separa uma resposta de um
-- bloqueio.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Templates ────────────────────────────────────────────────────────────
-- Variáveis: {cliente} {salao} {data} {hora} {servico} {com_quem} {tempo}
--            {cupom} {link}
--
-- {com_quem}, {cupom} e {link} carregam a própria pontuação/quebra de linha e
-- renderizam vazio quando não há dado — assim a frase continua correta sem o
-- pedaço, em vez de virar "Quer marcar com ?".
--
-- Três variações por tipo pelo mesmo motivo das outras: texto idêntico
-- repetido é impressão digital de robô.
insert into public.whatsapp_templates (salon_id, kind, body) values
  -- Faltou. Tom: sem cobrança. Quem não apareceu já sabe que não apareceu;
  -- mensagem que soa como cobrança não traz de volta, afasta de vez.
  (null, 'winback_no_show',
   E'Oi, {cliente}! Aqui é do *{salao}*.\nVocê tinha horário dia {data} às {hora} ({servico}) e acabou não dando pra vir — acontece! 😉\n\nQuer que eu remarque{com_quem}?{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'winback_no_show',
   E'{cliente}, tudo bem?\nSeu {servico} de {data} ficou em aberto aqui no *{salao}*.\n\nMe diz um dia que seja bom pra você que eu já separo.{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'winback_no_show',
   E'Oi, {cliente}! Sentimos sua falta no dia {data}, aqui no *{salao}* 💚\nSem problema nenhum — quando quiser, a gente remarca seu {servico}{com_quem}.{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),

  -- Cancelou. Tom: prestativo. Essa pessoa avisou que não vinha — tratar
  -- igual a quem faltou é punir o cliente que fez a coisa certa.
  (null, 'winback_cancelled',
   E'Oi, {cliente}! Vi aqui que seu horário de {data} no *{salao}* foi cancelado.\nJá quer deixar outro marcado{com_quem}?{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'winback_cancelled',
   E'{cliente}, tudo certo?\nSeu {servico} de {data} foi cancelado e você ainda não remarcou aqui no *{salao}*.\n\nSe quiser, é só me dizer o melhor dia.{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'winback_cancelled',
   E'Oi, {cliente}! Aqui é do *{salao}*.\nAquele horário de {data} que você desmarcou ficou pendente — bora escolher uma data nova?{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),

  -- Sumiu. Tom: saudade, e o tempo exato — "faz 3 meses" prova que alguém
  -- olhou a ficha dele, "faz um tempinho" é o que todo disparo em massa diz.
  (null, 'winback_inactive',
   E'Oi, {cliente}! Faz {tempo} desde seu último {servico} aqui no *{salao}* 😊\nJá tá na hora, né? Quer marcar{com_quem}?{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'winback_inactive',
   E'{cliente}, que saudade de você por aqui! 💚\nSua última visita ao *{salao}* foi em {data}. Que tal marcar um horário?{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._'),
  (null, 'winback_inactive',
   E'Oi, {cliente}! Aqui é do *{salao}*.\nFaz {tempo} que a gente não te vê. Separo um horário pro seu {servico}{com_quem}?{cupom}{link}\n\n_Responda SAIR para não receber mais mensagens (e VOLTAR se mudar de ideia)._');

-- ── Renderização ─────────────────────────────────────────────────────────
-- whatsapp_render() parte de um agendamento; aqui o ponto de partida é o
-- CLIENTE, e o agendamento de referência é descoberto a partir do motivo:
-- faltou → a falta mais recente; cancelou → o cancelamento; sumiu → a última
-- visita concluída. É de lá que saem data, serviço e profissional.
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
  v_body text;
  v_status public.appointment_status;
  v_appt record;
  v_salao text;
  v_slug text;
  v_tz text;
  v_cliente text;
  v_servico text;
  v_com_quem text := '';
  v_tempo text := 'um tempo';
  v_dias int;
  v_cupom text := '';
  v_link text := '';
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
  if v_salao is null then return null; end if;

  select nullif(split_part(coalesce(c.full_name, ''), ' ', 1), '') into v_cliente
  from clients c where c.id = p_client_id;
  -- Mesmo fallback do render transacional: "Oi, tudo bem!" continua uma
  -- frase, "Oi, !" não.
  v_cliente := coalesce(v_cliente, 'tudo bem');

  v_status := case p_kind
    when 'winback_no_show'   then 'no_show'
    when 'winback_cancelled' then 'cancelled'
    else 'completed'
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
    -- Nome gravado em appointment_services, não o da tabela services: é o
    -- snapshot do que foi vendido, e o serviço pode ter sido renomeado ou
    -- excluído desde então.
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

  -- Domínio fixo pelo mesmo motivo da URL da Edge Function nas outras
  -- migrações: o banco não enxerga as variáveis de ambiente do app.
  if v_slug is not null then
    v_link := E'\n\nSe preferir, dá pra agendar por aqui: https://zulan.com.br/' || v_slug;
  end if;

  v_body := replace(v_body, '{cliente}',   v_cliente);
  v_body := replace(v_body, '{salao}',     v_salao);
  v_body := replace(v_body, '{data}',      coalesce(v_appt.data, 'sua última visita'));
  v_body := replace(v_body, '{hora}',      coalesce(v_appt.hora, ''));
  v_body := replace(v_body, '{servico}',   v_servico);
  v_body := replace(v_body, '{com_quem}',  v_com_quem);
  v_body := replace(v_body, '{tempo}',     v_tempo);
  v_body := replace(v_body, '{cupom}',     v_cupom);
  v_body := replace(v_body, '{link}',      v_link);

  return v_body;
end;
$function$;

-- ── Envio ────────────────────────────────────────────────────────────────
-- Chamada pelo navegador (RPC), um cliente por clique. Devolve jsonb em vez
-- de erro para os casos previstos: "esse cliente pediu para não receber" não
-- é falha do sistema, é resposta — e a tela precisa poder mostrar o motivo em
-- português, não um toast genérico de erro.
create or replace function public.whatsapp_winback_send(
  p_salon uuid,
  p_client uuid,
  p_bucket text,
  p_campaign uuid default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind public.whatsapp_message_kind;
  v_inst record;
  v_phone text;
  v_opt_out boolean;
  v_body text;
  v_cupom text;
  v_desc int;
  v_recentes int;
  v_hora int;
begin
  -- Mesma permissão que abre a página: quem pode ver a lista pode chamar.
  if not (has_permission(p_salon, 'campaigns.manage')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  v_kind := case p_bucket
    when 'no_shows'  then 'winback_no_show'
    when 'cancelled' then 'winback_cancelled'
    when 'inactive'  then 'winback_inactive'
    else null
  end::public.whatsapp_message_kind;
  if v_kind is null then
    return jsonb_build_object('ok', false, 'reason', 'bucket_invalido');
  end if;

  -- security definer ignora RLS: sem esta linha, um id de cliente de outro
  -- salão passaria direto.
  select normalize_br_phone(c.phone), c.whatsapp_opt_out
    into v_phone, v_opt_out
  from clients c
  where c.id = p_client and c.salon_id = p_salon;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'cliente_invalido');
  end if;

  select * into v_inst from whatsapp_instances where salon_id = p_salon;
  if v_inst is null or v_inst.status <> 'connected' then
    -- A tela cai no wa.me quando vê isto: melhor abrir o WhatsApp na mão do
    -- que deixar o dono sem conseguir chamar o cliente.
    return jsonb_build_object('ok', false, 'reason', 'nao_conectado');
  end if;

  if coalesce(v_opt_out, false) then
    return jsonb_build_object('ok', false, 'reason', 'opt_out');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_telefone');
  end if;

  -- Não perseguir: no máximo um chamado de recuperação por cliente a cada 21
  -- dias. Quem sumiu e recebeu uma mensagem não volta porque recebeu quatro —
  -- só bloqueia mais rápido.
  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = p_client
    and o.kind in ('winback_no_show', 'winback_cancelled', 'winback_inactive')
    and o.status in ('queued', 'sending', 'sent')
    and o.created_at > now() - interval '21 days';
  if v_recentes > 0 then
    return jsonb_build_object('ok', false, 'reason', 'ja_chamado');
  end if;

  -- Teto geral (o mesmo do whatsapp_enqueue): 4 mensagens por cliente em 7
  -- dias, somando transacional e recuperação.
  select count(*) into v_recentes
  from whatsapp_outbox o
  where o.client_id = p_client
    and o.status in ('queued', 'sending', 'sent')
    and o.created_at > now() - interval '7 days';
  if v_recentes >= 4 then
    return jsonb_build_object('ok', false, 'reason', 'limite_semanal');
  end if;

  if p_campaign is not null then
    select c.name, c.discount_percent into v_cupom, v_desc
    from campaigns c
    where c.id = p_campaign and c.salon_id = p_salon and c.is_active;
  end if;

  v_body := whatsapp_render_winback(v_kind, p_salon, p_client, v_cupom, v_desc);
  if v_body is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_template');
  end if;

  insert into whatsapp_outbox (salon_id, client_id, kind, phone, body)
  values (p_salon, p_client, v_kind, v_phone, v_body);

  -- Mesmo efeito do clique antigo no wa.me: o Gestor para de sugerir chamar
  -- quem acabou de ser chamado.
  update clients set last_contacted_at = now() where id = p_client;

  -- A fila só entrega entre 8h e 20h no fuso do salão. Quem clica às 22h
  -- precisa saber que a mensagem sai de manhã, senão vai achar que falhou e
  -- clicar de novo.
  select extract(hour from (now() at time zone s.timezone))::int into v_hora
  from salons s where s.id = p_salon;

  return jsonb_build_object(
    'ok', true,
    'preview', v_body,
    'fora_janela', v_hora < 8 or v_hora > 19
  );
end;
$function$;

-- O padrão do Postgres é conceder EXECUTE a PUBLIC; revogar de PUBLIC e
-- devolver só a authenticated é o que de fato fecha para anônimo.
revoke execute on function public.whatsapp_render_winback(public.whatsapp_message_kind, uuid, uuid, text, int) from public;
revoke execute on function public.whatsapp_winback_send(uuid, uuid, text, uuid) from public;
grant execute on function public.whatsapp_winback_send(uuid, uuid, text, uuid) to authenticated;
