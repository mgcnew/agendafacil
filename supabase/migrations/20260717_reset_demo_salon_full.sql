-- reset_demo_salon v3 — popula TODAS as telas do painel, não só agenda/serviços.
--
-- Motivo: quem testa o demo abre Financeiro/Estoque/Pacotes/Campanhas e via
-- "nenhum dado" — o vazio vende o contrário do que a gente quer. Agora cada
-- página abre com um retrato plausível de um salão em operação.
--
-- Também corrige o payment_method 'cartao' do seed antigo: a UI só conhece
-- dinheiro/pix/debito/credito, então 'cartao' aparecia como método desconhecido.
--
-- Membros (contas demo) persistem entre resets; todo o resto é recriado.
create or replace function public.reset_demo_salon(p_salon uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_niche text;
  v_key text;
  v_today date;
  r record;
  v_sid uuid; v_price numeric; v_dur int; v_comm numeric; v_cid uuid;
  v_start timestamptz; v_end timestamptz; v_appt uuid;
  v_members uuid[]; v_mcount int; v_i int := 0; v_member uuid;
  v_owner_profile uuid;
  v_tpl uuid; v_pkg uuid; v_item uuid;
  v_sess uuid; v_delta numeric; v_opening numeric := 150;
  v_camp_all uuid; v_camp_disc numeric; v_fator numeric;
  v_d int;
begin
  if not exists (select 1 from salons where id = p_salon and is_demo) then
    raise exception 'reset_demo_salon: salão % não é demo', p_salon;
  end if;

  -- Membros ativos (dono primeiro), pra distribuir os agendamentos.
  select array_agg(id order by (role = 'owner') desc, id) into v_members
  from salon_members where salon_id = p_salon and is_active;
  v_mcount := coalesce(array_length(v_members, 1), 0);
  if v_mcount = 0 then raise exception 'reset_demo_salon: salão % sem membros ativos', p_salon; end if;

  select profile_id into v_owner_profile
  from salon_members where salon_id = p_salon and role = 'owner' limit 1;

  select niche::text into v_niche from salons where id = p_salon;
  v_key := case when v_niche = 'barbearia' then 'barbearia' else 'feminino' end;
  v_today := (now() at time zone 'America/Sao_Paulo')::date;

  -- ── limpeza (ordem respeita as FKs) ──────────────────────────────────
  delete from package_redemptions where salon_id = p_salon;
  delete from client_package_items where salon_id = p_salon;
  delete from client_packages where salon_id = p_salon;
  delete from package_template_items where salon_id = p_salon;
  delete from package_templates where salon_id = p_salon;
  delete from commission_payments where salon_id = p_salon;
  delete from cash_transactions where salon_id = p_salon;
  delete from cash_sessions where salon_id = p_salon;
  delete from stock_movements where salon_id = p_salon;
  delete from service_products where salon_id = p_salon;
  delete from products where salon_id = p_salon;
  delete from fixed_costs where salon_id = p_salon;
  delete from appointment_services where salon_id = p_salon;
  delete from appointments where salon_id = p_salon;
  delete from campaign_services where salon_id = p_salon;
  delete from campaigns where salon_id = p_salon;
  delete from clients where salon_id = p_salon;
  delete from professional_services where salon_id = p_salon;
  delete from services where salon_id = p_salon;

  -- ── serviços ─────────────────────────────────────────────────────────
  insert into services (salon_id, name, duration_min, price, commission_percent, is_active)
  select p_salon, x.name, x.dur, x.price, x.comm, true
  from (values
    ('feminino','Corte feminino',60,70,40),
    ('feminino','Escova',45,50,40),
    ('feminino','Hidratação',60,90,40),
    ('feminino','Coloração',120,180,40),
    ('feminino','Luzes / Mechas',180,320,40),
    ('feminino','Manicure',40,35,50),
    ('feminino','Pedicure',50,45,50),
    ('feminino','Design de sobrancelha',30,40,50),
    ('feminino','Maquiagem',60,150,45),
    ('feminino','Limpeza de pele',60,120,45),
    ('barbearia','Corte masculino',40,45,45),
    ('barbearia','Corte + Barba',60,70,45),
    ('barbearia','Barba',30,35,50),
    ('barbearia','Pézinho / Acabamento',15,20,50),
    ('barbearia','Platinado',120,180,40),
    ('barbearia','Sobrancelha',15,20,50),
    ('barbearia','Hidratação capilar',30,40,45),
    ('barbearia','Corte infantil',30,35,45)
  ) as x(niche,name,dur,price,comm)
  where x.niche = v_key;

  -- Todo profissional ativo faz todos os serviços. Sem esse vínculo o
  -- agendamento público não lista ninguém ("nenhum profissional disponível"),
  -- porque a tela só considera profissional que tenha serviço atribuído.
  insert into professional_services (salon_id, member_id, service_id)
  select p_salon, m.id, s.id
  from salon_members m
  cross join services s
  where m.salon_id = p_salon and m.is_active and s.salon_id = p_salon;

  -- ── clientes ─────────────────────────────────────────────────────────
  -- bday: dias até o aniversário (0 = hoje) ou null. Garante que o card de
  -- aniversariante do Gestor tenha sempre alguém pra mostrar.
  insert into clients (salon_id, full_name, phone, birth_date, notes)
  select p_salon, x.nome, x.fone,
         case when x.bday is null then null
              else ((v_today + x.bday) - (x.idade || ' years')::interval)::date end,
         x.obs
  from (values
    ('feminino','Ana Souza','11991000001',0,34,'Alergia a amônia — usar coloração sem amônia.'),
    ('feminino','Beatriz Lima','11991000002',12,27,null),
    ('feminino','Camila Rocha','11991000003',null,null,'Prefere atendimento no fim da tarde.'),
    ('feminino','Daniela Alves','11991000004',3,41,null),
    ('feminino','Fernanda Dias','11991000005',null,null,null),
    ('feminino','Juliana Martins','11991000006',25,23,null),
    ('feminino','Patrícia Gomes','11991000007',null,null,null),
    ('feminino','Renata Castro','11991000008',null,null,'Costuma remarcar — confirmar na véspera.'),
    ('feminino','Sônia Prado','11991000009',null,null,null),
    ('feminino','Vera Lúcia Nunes','11991000010',null,null,null),
    ('feminino','Tânia Melo','11991000011',null,null,null),
    ('feminino','Kelly Souza','11991000012',null,null,null),
    ('barbearia','Bruno Alves','11992000001',0,31,null),
    ('barbearia','Carlos Nunes','11992000002',8,45,null),
    ('barbearia','Diego Ramos','11992000003',null,null,'Gosta de máquina 2 nas laterais.'),
    ('barbearia','Eduardo Pinto','11992000004',18,26,null),
    ('barbearia','Felipe Souza','11992000005',null,null,null),
    ('barbearia','Gabriel Rocha','11992000006',null,null,null),
    ('barbearia','Marcelo Dias','11992000007',null,null,null),
    ('barbearia','Rafael Lima','11992000008',null,null,'Sempre pede o mesmo horário: sábado 10h.'),
    ('barbearia','Otávio Reis','11992000009',null,null,null),
    ('barbearia','Sérgio Matos','11992000010',null,null,null),
    ('barbearia','Vitor Hugo Alves','11992000011',null,null,null),
    ('barbearia','Igor Prado','11992000012',null,null,null)
  ) as x(niche,nome,fone,bday,idade,obs)
  where x.niche = v_key;

  -- ── campanhas ────────────────────────────────────────────────────────
  insert into campaigns (salon_id, name, discount_percent, scope, is_active, starts_on, ends_on)
  select p_salon, x.nome, x.disc, x.scope, true, v_today - 20, v_today + 40
  from (values
    ('feminino','Volta pra gente',15,'all'),
    ('feminino','Terça da Escova',20,'services'),
    ('barbearia','Volta pra gente',15,'all'),
    ('barbearia','Combo Corte + Barba',15,'services')
  ) as x(niche,nome,disc,scope)
  where x.niche = v_key;

  -- serviços da campanha com escopo restrito
  insert into campaign_services (salon_id, campaign_id, service_id)
  select p_salon, c.id, s.id
  from campaigns c
  join services s on s.salon_id = p_salon and s.name = case
    when v_key = 'feminino' then 'Escova' else 'Corte + Barba' end
  where c.salon_id = p_salon and c.scope = 'services';

  select id, discount_percent into v_camp_all, v_camp_disc
  from campaigns where salon_id = p_salon and scope = 'all' limit 1;
  v_fator := 1 - (v_camp_disc / 100.0);

  -- ── estoque ──────────────────────────────────────────────────────────
  -- Um item propositalmente abaixo do mínimo: acende o aviso de estoque
  -- baixo no Gestor e mostra a tela de Estoque fazendo o trabalho dela.
  insert into products (salon_id, name, sku, unit, cost_price, sale_price, quantity, min_quantity, is_resale, is_active)
  select p_salon, x.nome, x.sku, x.un, x.custo, x.venda, x.qtd, x.min, x.revenda, true
  from (values
    ('feminino','Shampoo Profissional 1L','SH-1L','un',45,0,6,3,false),
    ('feminino','Condicionador 1L','CO-1L','un',48,0,2,3,false),
    ('feminino','Coloração Louro 60g','COL-60','un',22,0,12,5,false),
    ('feminino','Água Oxigenada 20vol','OX-20','un',14,0,8,4,false),
    ('feminino','Máscara de Hidratação 500g','MSC-500','un',60,0,5,2,false),
    ('feminino','Óleo Reparador 60ml','OL-60','un',28,69,10,3,true),
    ('feminino','Shampoo Home Care 300ml','SH-HC','un',35,89,4,2,true),
    ('barbearia','Pomada Modeladora 120g','PM-120','un',18,45,12,4,true),
    ('barbearia','Óleo para Barba 30ml','OB-30','un',22,55,3,4,true),
    ('barbearia','Lâmina Descartável (cx 100)','LM-100','cx',35,0,20,5,false),
    ('barbearia','Talco Barbearia 100g','TL-100','un',12,0,6,2,false),
    ('barbearia','Shampoo para Barba 1L','SB-1L','un',40,0,4,2,false),
    ('barbearia','Cera Capilar 100g','CR-100','un',20,49,8,3,true)
  ) as x(niche,nome,sku,un,custo,venda,qtd,min,revenda)
  where x.niche = v_key;

  -- entrada inicial de estoque (dá histórico pra tela de movimentações)
  insert into stock_movements (salon_id, product_id, type, quantity, reason, created_at)
  select p_salon, p.id, 'in', p.quantity + 4, 'Compra inicial',
         ((v_today - 30)::timestamp + interval '9 hours') at time zone 'America/Sao_Paulo'
  from products p where p.salon_id = p_salon;

  -- Baixas espalhadas no tempo (somam as 4 da compra inicial): um extrato
  -- todo igual, no mesmo minuto, denuncia que o dado é de mentira.
  insert into stock_movements (salon_id, product_id, type, quantity, reason, created_at)
  select p_salon, p.id, 'out', m.qtd, m.motivo,
         ((v_today - m.doff)::timestamp + (m.hr * interval '1 hour')) at time zone 'America/Sao_Paulo'
  from products p
  cross join (values
    (21, 11, 2, 'Consumo em atendimentos'),
    (12, 16, 1, 'Consumo em atendimentos'),
    (5, 10, 1, 'Consumo em atendimentos')
  ) as m(doff,hr,qtd,motivo)
  where p.salon_id = p_salon;

  -- insumo por serviço: baixa automática ao finalizar o atendimento
  insert into service_products (salon_id, service_id, product_id, quantity)
  select p_salon, s.id, p.id, x.qtd
  from (values
    ('feminino','Escova','Shampoo Profissional 1L',0.05),
    ('feminino','Coloração','Coloração Louro 60g',1),
    ('feminino','Coloração','Água Oxigenada 20vol',0.5),
    ('feminino','Hidratação','Máscara de Hidratação 500g',0.1),
    ('barbearia','Barba','Shampoo para Barba 1L',0.03),
    ('barbearia','Corte masculino','Talco Barbearia 100g',0.02)
  ) as x(niche,svc,prod,qtd)
  join services s on s.salon_id = p_salon and s.name = x.svc
  join products p on p.salon_id = p_salon and p.name = x.prod
  where x.niche = v_key;

  -- ── custos fixos ─────────────────────────────────────────────────────
  insert into fixed_costs (salon_id, name, amount, due_day, type, is_active)
  select p_salon, x.nome, x.valor, x.dia, 'expense', true
  from (values
    ('feminino','Aluguel',2800,5),
    ('feminino','Energia elétrica',380,10),
    ('feminino','Água',90,10),
    ('feminino','Internet',120,15),
    ('feminino','Contador',250,20),
    ('barbearia','Aluguel',1900,5),
    ('barbearia','Energia elétrica',260,10),
    ('barbearia','Internet',110,15),
    ('barbearia','Contador',250,20)
  ) as x(niche,nome,valor,dia)
  where x.niche = v_key;

  -- ── agenda / histórico ───────────────────────────────────────────────
  -- Histórico longo (até -80d) alimenta Relatórios; no_show/cancelado e
  -- clientes sem retorno alimentam a tela Recuperar (marketing_winback:
  -- inativo = último concluído há +45d e sem agendamento futuro).
  for r in
    select * from (values
      -- feminino — histórico
      ('feminino','Sônia Prado','Coloração',-80,14,'completed','pix'),
      ('feminino','Vera Lúcia Nunes','Corte feminino',-62,10,'completed','dinheiro'),
      ('feminino','Ana Souza','Escova',-55,9,'completed','pix'),
      ('feminino','Beatriz Lima','Luzes / Mechas',-48,14,'completed','credito'),
      ('feminino','Camila Rocha','Manicure',-40,10,'completed','dinheiro'),
      ('feminino','Daniela Alves','Hidratação',-33,11,'completed','pix'),
      ('feminino','Fernanda Dias','Corte feminino',-27,15,'completed','debito'),
      ('feminino','Juliana Martins','Escova',-21,9,'completed','pix'),
      ('feminino','Patrícia Gomes','Maquiagem',-18,16,'completed','credito'),
      ('feminino','Renata Castro','Coloração',-14,10,'completed','pix'),
      ('feminino','Ana Souza','Manicure',-11,14,'completed','dinheiro'),
      ('feminino','Camila Rocha','Pedicure',-9,11,'completed','pix'),
      ('feminino','Tânia Melo','Escova',-8,15,'no_show',null),
      ('feminino','Beatriz Lima','Design de sobrancelha',-7,9,'completed','debito'),
      -- feminino — semana corrente
      ('feminino','Ana Souza','Corte feminino',-6,9,'completed','pix'),
      ('feminino','Beatriz Lima','Coloração',-6,14,'completed','credito'),
      ('feminino','Camila Rocha','Manicure',-5,10,'completed','dinheiro'),
      ('feminino','Kelly Souza','Hidratação',-5,16,'cancelled',null),
      ('feminino','Daniela Alves','Escova',-4,11,'completed','pix'),
      ('feminino','Fernanda Dias','Luzes / Mechas',-3,15,'completed','credito'),
      ('feminino','Tânia Melo','Manicure',-3,11,'no_show',null),
      ('feminino','Juliana Martins','Design de sobrancelha',-2,9,'completed','pix'),
      ('feminino','Patrícia Gomes','Hidratação',-2,16,'completed','dinheiro'),
      ('feminino','Renata Castro','Maquiagem',-1,10,'completed','debito'),
      ('feminino','Ana Souza','Escova',-1,14,'completed','pix'),
      -- feminino — hoje e futuro
      ('feminino','Camila Rocha','Corte feminino',0,9,'completed','pix'),
      ('feminino','Daniela Alves','Manicure',0,11,'in_progress',null),
      ('feminino','Ana Souza','Escova',0,14,'confirmed',null),
      ('feminino','Fernanda Dias','Hidratação',0,16,'confirmed',null),
      ('feminino','Beatriz Lima','Corte feminino',1,9,'confirmed',null),
      ('feminino','Juliana Martins','Limpeza de pele',1,15,'pending',null),
      ('feminino','Daniela Alves','Pedicure',2,10,'confirmed',null),
      ('feminino','Patrícia Gomes','Coloração',3,11,'confirmed',null),
      -- barbearia — histórico
      ('barbearia','Otávio Reis','Platinado',-80,14,'completed','pix'),
      ('barbearia','Sérgio Matos','Corte masculino',-62,10,'completed','dinheiro'),
      ('barbearia','Bruno Alves','Corte + Barba',-55,9,'completed','pix'),
      ('barbearia','Carlos Nunes','Corte masculino',-48,14,'completed','credito'),
      ('barbearia','Diego Ramos','Barba',-40,10,'completed','dinheiro'),
      ('barbearia','Eduardo Pinto','Corte masculino',-33,11,'completed','pix'),
      ('barbearia','Felipe Souza','Corte + Barba',-27,15,'completed','debito'),
      ('barbearia','Gabriel Rocha','Pézinho / Acabamento',-21,9,'completed','dinheiro'),
      ('barbearia','Marcelo Dias','Corte + Barba',-18,16,'completed','credito'),
      ('barbearia','Rafael Lima','Corte masculino',-14,10,'completed','pix'),
      ('barbearia','Bruno Alves','Barba',-11,14,'completed','dinheiro'),
      ('barbearia','Diego Ramos','Corte masculino',-9,11,'completed','pix'),
      ('barbearia','Vitor Hugo Alves','Corte + Barba',-8,15,'no_show',null),
      ('barbearia','Carlos Nunes','Sobrancelha',-7,9,'completed','debito'),
      -- barbearia — semana corrente
      ('barbearia','Bruno Alves','Corte masculino',-6,9,'completed','pix'),
      ('barbearia','Carlos Nunes','Corte + Barba',-6,14,'completed','credito'),
      ('barbearia','Diego Ramos','Barba',-5,10,'completed','dinheiro'),
      ('barbearia','Igor Prado','Corte infantil',-5,16,'cancelled',null),
      ('barbearia','Eduardo Pinto','Corte masculino',-4,11,'completed','pix'),
      ('barbearia','Felipe Souza','Platinado',-3,15,'completed','credito'),
      ('barbearia','Vitor Hugo Alves','Barba',-3,11,'no_show',null),
      ('barbearia','Gabriel Rocha','Pézinho / Acabamento',-2,9,'completed','pix'),
      ('barbearia','Marcelo Dias','Corte + Barba',-2,16,'completed','dinheiro'),
      ('barbearia','Rafael Lima','Corte masculino',-1,10,'completed','debito'),
      ('barbearia','Bruno Alves','Barba',-1,14,'completed','pix'),
      -- barbearia — hoje e futuro
      ('barbearia','Diego Ramos','Corte masculino',0,9,'completed','pix'),
      ('barbearia','Eduardo Pinto','Barba',0,11,'in_progress',null),
      ('barbearia','Bruno Alves','Corte + Barba',0,14,'confirmed',null),
      ('barbearia','Gabriel Rocha','Corte masculino',0,16,'confirmed',null),
      ('barbearia','Carlos Nunes','Corte + Barba',1,9,'confirmed',null),
      ('barbearia','Felipe Souza','Corte infantil',1,15,'pending',null),
      ('barbearia','Marcelo Dias','Hidratação capilar',2,10,'confirmed',null),
      ('barbearia','Rafael Lima','Corte masculino',3,11,'confirmed',null)
    ) as t(niche,cli,svc,doff,hr,st,pay)
    where t.niche = v_key
    order by t.doff, t.hr
  loop
    select id, price, duration_min, coalesce(commission_percent, 0)
      into v_sid, v_price, v_dur, v_comm
    from services where salon_id = p_salon and name = r.svc limit 1;

    select id into v_cid from clients where salon_id = p_salon and full_name = r.cli limit 1;

    -- distribui entre os membros ativos (round-robin)
    v_member := v_members[(v_i % v_mcount) + 1];
    v_i := v_i + 1;

    v_start := ((v_today + r.doff)::timestamp + (r.hr * interval '1 hour')) at time zone 'America/Sao_Paulo';
    v_end := v_start + (v_dur * interval '1 minute');

    insert into appointments (salon_id, client_id, member_id, status, starts_at, ends_at, total_price, source, payment_method)
    values (p_salon, v_cid, v_member, r.st::appointment_status, v_start, v_end, v_price,
            case when r.doff >= 0 and r.st in ('confirmed','pending') then 'booking_link' else 'panel' end,
            case when r.st = 'completed' then r.pay else null end)
    returning id into v_appt;

    insert into appointment_services (salon_id, appointment_id, service_id, name, duration_min, price, commission_percent, commission_amount)
    values (p_salon, v_appt, v_sid, r.svc, v_dur, v_price, v_comm, round(v_price * v_comm / 100, 2));
  end loop;

  -- Alguns retornos vieram da campanha "Volta pra gente" — fecha o loop
  -- "criei o cupom → quanto ele trouxe" na aba Campanhas / Recuperar.
  -- Precisa gravar original_price: a tela mede o desconto concedido como
  -- (original_price - price), então marcar só o campaign_id mostrava uma
  -- campanha de 15% que teria dado R$ 0,00 de desconto.
  with alvo as (
    select asv.id, asv.price, asv.commission_percent
    from appointment_services asv
    join appointments a on a.id = asv.appointment_id
    where asv.salon_id = p_salon and a.status = 'completed'
      and a.starts_at >= (now() - interval '12 days')
    order by a.starts_at desc
    limit 3
  )
  update appointment_services asv set
    campaign_id = v_camp_all,
    original_price = alvo.price,
    price = round(alvo.price * v_fator, 2),
    commission_amount = round(round(alvo.price * v_fator, 2) * alvo.commission_percent / 100, 2)
  from alvo
  where asv.id = alvo.id;

  update appointments a set total_price = round(a.total_price * v_fator, 2)
  where a.salon_id = p_salon
    and exists (select 1 from appointment_services x
                where x.appointment_id = a.id and x.campaign_id = v_camp_all);

  -- ── pacotes ──────────────────────────────────────────────────────────
  insert into package_templates (salon_id, name, price, validity_days, is_active)
  select p_salon, x.nome, x.preco, 90, true
  from (values
    ('feminino','Combo Escova 4x',180),
    ('feminino','Pacote Manicure 4x',120),
    ('barbearia','Combo Corte 4x',160),
    ('barbearia','Pacote Barba 4x',120)
  ) as x(niche,nome,preco)
  where x.niche = v_key;

  insert into package_template_items (salon_id, template_id, service_id, quantity)
  select p_salon, t.id, s.id, 4
  from package_templates t
  join (values
    ('feminino','Combo Escova 4x','Escova'),
    ('feminino','Pacote Manicure 4x','Manicure'),
    ('barbearia','Combo Corte 4x','Corte masculino'),
    ('barbearia','Pacote Barba 4x','Barba')
  ) as x(niche,tpl,svc) on x.tpl = t.name and x.niche = v_key
  join services s on s.salon_id = p_salon and s.name = x.svc
  where t.salon_id = p_salon;

  -- Pacote 1: vendido há 20d, vence em 10d com saldo sobrando → aviso
  -- "pacote vencendo" no Gestor.
  select id into v_tpl from package_templates
   where salon_id = p_salon and name = case when v_key = 'feminino' then 'Combo Escova 4x' else 'Combo Corte 4x' end;
  select id into v_cid from clients
   where salon_id = p_salon and full_name = case when v_key = 'feminino' then 'Ana Souza' else 'Bruno Alves' end;

  insert into client_packages (salon_id, client_id, template_id, name, price, status, purchased_at, expires_at, sold_by)
  values (p_salon, v_cid, v_tpl,
          case when v_key = 'feminino' then 'Combo Escova 4x' else 'Combo Corte 4x' end,
          case when v_key = 'feminino' then 180 else 160 end,
          'active',
          (v_today - 20)::timestamp at time zone 'America/Sao_Paulo',
          (v_today + 10)::timestamp at time zone 'America/Sao_Paulo',
          v_owner_profile)
  returning id into v_pkg;

  select id, price into v_sid, v_price from services
   where salon_id = p_salon and name = case when v_key = 'feminino' then 'Escova' else 'Corte masculino' end;

  insert into client_package_items (salon_id, client_package_id, service_id, name, unit_price, total, used)
  values (p_salon, v_pkg, v_sid, case when v_key = 'feminino' then 'Escova' else 'Corte masculino' end,
          case when v_key = 'feminino' then 45 else 40 end, 4, 2)
  returning id into v_item;

  -- os 2 usos já consumidos, com comissão pro profissional
  insert into package_redemptions (salon_id, client_package_id, item_id, member_id, commission_amount, used_at)
  values
    (p_salon, v_pkg, v_item, v_members[1], case when v_key = 'feminino' then 18 else 18 end,
     (v_today - 18)::timestamp at time zone 'America/Sao_Paulo'),
    (p_salon, v_pkg, v_item, v_members[2 % v_mcount + 1], case when v_key = 'feminino' then 18 else 18 end,
     (v_today - 5)::timestamp at time zone 'America/Sao_Paulo');

  -- Pacote 2: comprado há 60d e nunca usado → aviso "pacote parado".
  select id into v_tpl from package_templates
   where salon_id = p_salon and name = case when v_key = 'feminino' then 'Pacote Manicure 4x' else 'Pacote Barba 4x' end;
  select id into v_cid from clients
   where salon_id = p_salon and full_name = case when v_key = 'feminino' then 'Beatriz Lima' else 'Carlos Nunes' end;

  insert into client_packages (salon_id, client_id, template_id, name, price, status, purchased_at, expires_at, sold_by)
  values (p_salon, v_cid, v_tpl,
          case when v_key = 'feminino' then 'Pacote Manicure 4x' else 'Pacote Barba 4x' end,
          120, 'active',
          (v_today - 60)::timestamp at time zone 'America/Sao_Paulo',
          (v_today + 30)::timestamp at time zone 'America/Sao_Paulo',
          v_owner_profile)
  returning id into v_pkg;

  select id into v_sid from services
   where salon_id = p_salon and name = case when v_key = 'feminino' then 'Manicure' else 'Barba' end;

  insert into client_package_items (salon_id, client_package_id, service_id, name, unit_price, total, used)
  values (p_salon, v_pkg, v_sid, case when v_key = 'feminino' then 'Manicure' else 'Barba' end, 30, 4, 0);

  -- ── caixa ────────────────────────────────────────────────────────────
  -- Caixas fechados dos últimos dias + o de hoje aberto. As receitas seguem
  -- o mesmo formato do finalize_appointment (category 'atendimento').
  foreach v_d in array array[-3, -2, -1, 0]
  loop
    insert into cash_sessions (salon_id, opened_by, opened_at, opening_amount)
    values (p_salon, v_owner_profile,
            ((v_today + v_d)::timestamp + interval '8 hours') at time zone 'America/Sao_Paulo',
            v_opening)
    returning id into v_sess;

    -- receita de cada atendimento concluído no dia
    insert into cash_transactions (salon_id, session_id, type, category, amount, payment_method,
                                   appointment_id, member_id, description, created_at, created_by)
    select p_salon, v_sess, 'income', 'atendimento', a.total_price, a.payment_method,
           a.id, a.member_id, 'Atendimento · ' || coalesce(c.full_name, 'Cliente'), a.ends_at, v_owner_profile
    from appointments a
    left join clients c on c.id = a.client_id
    where a.salon_id = p_salon and a.status = 'completed'
      and (a.starts_at at time zone 'America/Sao_Paulo')::date = v_today + v_d
      -- o de hoje às 11h fica sem receber de propósito: aparece em "a receber"
      and a.payment_method is not null;

    -- uma despesa e uma sangria por dia, pra tela não ficar só de entradas
    insert into cash_transactions (salon_id, session_id, type, category, amount, payment_method, description, created_at, created_by)
    values
      (p_salon, v_sess, 'expense', null, 38, 'dinheiro', 'Café e água',
       ((v_today + v_d)::timestamp + interval '10 hours') at time zone 'America/Sao_Paulo', v_owner_profile),
      (p_salon, v_sess, 'expense', 'sangria', 100, 'dinheiro', 'Sangria',
       ((v_today + v_d)::timestamp + interval '17 hours') at time zone 'America/Sao_Paulo', v_owner_profile);

    -- fecha todos menos o de hoje
    if v_d < 0 then
      select coalesce(sum(amount) filter (where type = 'income' and coalesce(payment_method,'dinheiro') = 'dinheiro'), 0)
           - coalesce(sum(amount) filter (where type = 'expense' and coalesce(payment_method,'dinheiro') = 'dinheiro'), 0)
        into v_delta
      from cash_transactions where session_id = v_sess;

      update cash_sessions set
        closed_by = v_owner_profile,
        closed_at = ((v_today + v_d)::timestamp + interval '19 hours') at time zone 'America/Sao_Paulo',
        expected_amount = v_opening + v_delta,
        -- um dia fecha com quebra de caixa: mostra o confere/diferença funcionando
        closing_amount = v_opening + v_delta + case when v_d = -2 then -5 else 0 end,
        difference = case when v_d = -2 then -5 else 0 end
      where id = v_sess;
    end if;
  end loop;

  -- ── comissões já pagas no mês corrente (parcial) ─────────────────────
  insert into commission_payments (salon_id, member_id, amount, period_start, period_end, notes, created_by, created_at)
  select p_salon, v_members[1], 120, date_trunc('month', v_today)::date,
         (date_trunc('month', v_today) + interval '1 month - 1 day')::date,
         'Adiantamento quinzenal', v_owner_profile, now() - interval '2 days';
end;
$function$;
