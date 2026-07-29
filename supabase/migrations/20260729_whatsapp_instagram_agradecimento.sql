-- ─────────────────────────────────────────────────────────────────────────
-- O Instagram do salão na mensagem de agradecimento.
--
-- Por que aqui e não em mais um canto da página pública: a mensagem de
-- agradecimento chega no CELULAR de quem acabou de ser atendido, e no celular
-- o Instagram é um toque — não um clique num navegador que abre um app que
-- pede login. Além disso o momento é o certo: a pessoa acabou de sair
-- satisfeita, e é aí que ela quer ver a própria foto publicada.
--
-- A página pública fica com o ícone no topo (quem ainda vai marcar e quer ver
-- trabalho antes) e o bloco na confirmação. Esta mensagem é a terceira ponta,
-- e a de maior alcance real: alcança 100% de quem foi atendido.
--
-- Só entra quando o salão preencheu o campo. Sem Instagram cadastrado, a
-- variável some e a mensagem fica exatamente como era.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Normalização do usuário ──────────────────────────────────────────────
-- Mesma duplicação consciente de normalize_br_phone: existe em TS
-- (src/lib/social.ts) para a página e aqui para a fila, porque as duas leem o
-- mesmo campo cru por caminhos diferentes. O dono digita "@salao" num dia e
-- cola o link com ?igsh=... no outro.
create or replace function public.instagram_handle(p_raw text)
 returns text
 language plpgsql
 immutable
as $function$
declare
  v text;
begin
  if p_raw is null then return null; end if;
  v := btrim(p_raw);
  if v = '' then return null; end if;

  v := regexp_replace(v, '^https?://', '', 'i');
  v := regexp_replace(v, '^www\.', '', 'i');
  v := regexp_replace(v, '^(instagram\.com|instagr\.am)/', '', 'i');
  v := ltrim(v, '@');
  -- Corta o que vem depois do usuário: /reel/..., ?igsh=..., #...
  v := split_part(split_part(split_part(v, '/', 1), '?', 1), '#', 1);

  -- Usuário do Instagram: letras, números, ponto e underline, até 30.
  if v !~ '^[A-Za-z0-9._]{1,30}$' then return null; end if;
  return v;
end;
$function$;

-- ── Renderização ─────────────────────────────────────────────────────────
-- Acrescenta {instagram} ao render. As demais variáveis seguem iguais; quem
-- não usa a nova simplesmente não a cita.
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
    instagram_handle(s.instagram) as insta
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  where a.id = p_appointment_id;

  if r is null then return null; end if;

  select string_agg(aps.name, ' + ' order by aps.name) into v_servico
  from appointment_services aps
  where aps.appointment_id = p_appointment_id;

  -- Bloco inteiro (com a quebra de linha) ou nada: assim a frase continua
  -- correta quando o salão não tem Instagram, sem sobrar linha em branco.
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

  return v_body;
end;
$function$;

-- ── Templates ────────────────────────────────────────────────────────────
-- Só no agradecimento. No comprovante de agendamento seria fora de hora: a
-- pessoa ainda nem foi atendida, e a mensagem existe pra confirmar horário,
-- não pra divulgar. Uma mensagem com dois pedidos não cumpre nenhum bem.
update public.whatsapp_templates
set body = replace(
  body,
  E'\n\n_Responda SAIR',
  E'{instagram}\n\n_Responda SAIR'
)
where kind = 'thank_you'
  and body not like '%{instagram}%';
