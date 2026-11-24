-- Demonstração com cara de salão de verdade. A demo é a principal prova do
-- produto (PRODUCT.md) e a página de agendamento dela mostrava desconto em
-- TODOS os serviços, o endereço "rua teste 999" e "Pézinho" (é "pezinho").
--
-- A "Volta pra gente" (15% em tudo) continua existindo — a aba Campanhas e a
-- de Recuperar usam o resultado dela — mas como campanha já encerrada: fica
-- no histórico e para de riscar o preço de todo serviço no link público. A
-- promoção visível passa a ser uma só por nicho (Escova / Corte + Barba).
--
-- A função reset_demo_salon no banco já divergiu do arquivo da migração
-- 20260717 (foi editada direto). Em vez de reescrevê-la inteira a partir de
-- um arquivo velho, troca só os dois trechos na definição viva.
do $$
declare
  d text := pg_get_functiondef('public.reset_demo_salon(uuid)'::regprocedure);
  antes text := d;
begin
  d := replace(d, 'Pézinho', 'Pezinho');
  d := replace(
    d,
    'select p_salon, x.nome, x.disc, x.scope, true, v_today - 20, v_today + 40',
    'select p_salon, x.nome, x.disc, x.scope, true,'
      || ' case when x.scope = ''all'' then v_today - 60 else v_today - 20 end,'
      || ' case when x.scope = ''all'' then v_today - 5 else v_today + 40 end'
  );
  if position('v_today - 5 else v_today + 40' in d) = 0 then
    raise exception 'reset_demo_salon: trecho das campanhas não encontrado; nada foi alterado';
  end if;
  if d <> antes then
    execute d;
  end if;
end $$;

-- Dados de hoje (o reset diário só passa amanhã cedo).
update public.services sv
   set name = replace(sv.name, 'Pézinho', 'Pezinho')
  from public.salons s
 where s.id = sv.salon_id and s.is_demo and sv.name like '%Pézinho%';

update public.campaigns c
   set starts_on = (now() at time zone 'America/Sao_Paulo')::date - 60,
       ends_on   = (now() at time zone 'America/Sao_Paulo')::date - 5
  from public.salons s
 where s.id = c.salon_id and s.is_demo and c.scope = 'all';

update public.salons
   set address = 'Rua Augusta, 2080 · Cerqueira César · São Paulo - SP'
 where is_demo and slug = 'demo-barbearia' and address = 'rua teste 999';

-- Funcionamento de verdade em vez de 00:00–23:59 todos os dias, que gerava
-- ~90 horários por dia e "próximo livre às 00:00". Quem abre a demo de noite
-- agora vê o atalho "Próximo livre" levando à manhã seguinte. working_hours
-- não é recriado pelo reset diário. Os atendimentos semeados ficam entre 9h
-- e 18h; a barbearia abre domingo de manhã porque o seed também marca lá.
update public.working_hours wh
   set start_time = '09:00',
       end_time   = case when s.slug = 'demo-barbearia' and wh.weekday = 0 then '14:00'::time else '20:00'::time end
  from public.salons s
 where s.id = wh.salon_id and s.is_demo and wh.member_id is null
   and wh.start_time = '00:00' and wh.end_time = '23:59';
