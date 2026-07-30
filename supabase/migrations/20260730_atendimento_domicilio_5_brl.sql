-- ─────────────────────────────────────────────────────────────────────────
-- Dinheiro em português na mensagem da cliente.
--
-- O render saía "R$ 5.00". `to_char` usa o separador do lc_numeric do banco,
-- que aqui é en_US — ponto decimal, vírgula de milhar. Num relatório interno
-- passa; numa mensagem que a cliente lê, "R$ 5.00" parece erro de sistema, e
-- num valor de quatro dígitos vira ambiguidade de verdade: "R$ 1,250.00".
--
-- translate('.,' → ',.') troca os dois de uma vez, sem passo intermediário que
-- possa colidir.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.brl(p numeric)
 returns text
 language sql
 immutable
as $function$
  select 'R$ ' || translate(to_char(coalesce(p, 0), 'FM999G999G990D00'), '.,', ',.');
$function$;

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
    nullif(btrim(coalesce(s.google_business, '')), '') as google,
    coalesce(a.home_address, '') as endereco,
    brl(a.travel_fee) as taxa,
    brl(a.total_price) as total,
    brl(s.home_first_km_fee) || ' o primeiro km + ' ||
      brl(s.home_extra_km_fee) || ' por km adicional' as regra
  into r
  from appointments a
  join salons s on s.id = a.salon_id
  left join clients c on c.id = a.client_id
  where a.id = p_appointment_id;

  if r is null then return null; end if;

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
  v_body := replace(v_body, '{endereco}',  r.endereco);
  v_body := replace(v_body, '{taxa}',      r.taxa);
  v_body := replace(v_body, '{total}',     r.total);
  v_body := replace(v_body, '{regra}',     r.regra);

  return v_body;
end;
$function$;
