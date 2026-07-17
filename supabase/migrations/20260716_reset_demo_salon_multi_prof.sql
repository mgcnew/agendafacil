-- Atualiza reset_demo_salon: distribui os agendamentos entre TODOS os membros
-- ativos do salão demo (não só o dono), pra a agenda/comissões aparecerem
-- repartidas entre os profissionais. Membros (contas demo) persistem entre
-- resets; só serviços/clientes/agenda são recriados.
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
begin
  if not exists (select 1 from salons where id = p_salon and is_demo) then
    raise exception 'reset_demo_salon: salão % não é demo', p_salon;
  end if;

  -- Membros ativos (dono primeiro), pra distribuir os agendamentos.
  select array_agg(id order by (role = 'owner') desc, id) into v_members
  from salon_members where salon_id = p_salon and is_active;
  v_mcount := coalesce(array_length(v_members, 1), 0);
  if v_mcount = 0 then raise exception 'reset_demo_salon: salão % sem membros ativos', p_salon; end if;

  select niche::text into v_niche from salons where id = p_salon;
  v_key := case when v_niche = 'barbearia' then 'barbearia' else 'feminino' end;
  v_today := (now() at time zone 'America/Sao_Paulo')::date;

  delete from appointment_services where salon_id = p_salon;
  delete from appointments where salon_id = p_salon;
  delete from clients where salon_id = p_salon;
  delete from professional_services where salon_id = p_salon;
  delete from services where salon_id = p_salon;

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

  insert into clients (salon_id, full_name, phone)
  select p_salon, x.nome, x.fone
  from (values
    ('feminino','Ana Souza','11991000001'),
    ('feminino','Beatriz Lima','11991000002'),
    ('feminino','Camila Rocha','11991000003'),
    ('feminino','Daniela Alves','11991000004'),
    ('feminino','Fernanda Dias','11991000005'),
    ('feminino','Juliana Martins','11991000006'),
    ('feminino','Patrícia Gomes','11991000007'),
    ('feminino','Renata Castro','11991000008'),
    ('barbearia','Bruno Alves','11992000001'),
    ('barbearia','Carlos Nunes','11992000002'),
    ('barbearia','Diego Ramos','11992000003'),
    ('barbearia','Eduardo Pinto','11992000004'),
    ('barbearia','Felipe Souza','11992000005'),
    ('barbearia','Gabriel Rocha','11992000006'),
    ('barbearia','Marcelo Dias','11992000007'),
    ('barbearia','Rafael Lima','11992000008')
  ) as x(niche,nome,fone)
  where x.niche = v_key;

  for r in
    select * from (values
      ('feminino','Ana Souza','Corte feminino',-6,9,'completed','pix'),
      ('feminino','Beatriz Lima','Coloração',-6,14,'completed','cartao'),
      ('feminino','Camila Rocha','Manicure',-5,10,'completed','dinheiro'),
      ('feminino','Daniela Alves','Escova',-4,11,'completed','pix'),
      ('feminino','Fernanda Dias','Luzes / Mechas',-3,15,'completed','cartao'),
      ('feminino','Juliana Martins','Design de sobrancelha',-2,9,'completed','pix'),
      ('feminino','Patrícia Gomes','Hidratação',-2,16,'completed','dinheiro'),
      ('feminino','Renata Castro','Maquiagem',-1,10,'completed','cartao'),
      ('feminino','Ana Souza','Escova',0,14,'confirmed',null),
      ('feminino','Camila Rocha','Manicure',0,16,'confirmed',null),
      ('feminino','Beatriz Lima','Corte feminino',1,9,'confirmed',null),
      ('feminino','Fernanda Dias','Limpeza de pele',1,15,'pending',null),
      ('feminino','Daniela Alves','Pedicure',2,10,'confirmed',null),
      ('feminino','Juliana Martins','Coloração',3,11,'confirmed',null),
      ('barbearia','Bruno Alves','Corte masculino',-6,9,'completed','pix'),
      ('barbearia','Carlos Nunes','Corte + Barba',-6,14,'completed','cartao'),
      ('barbearia','Diego Ramos','Barba',-5,10,'completed','dinheiro'),
      ('barbearia','Eduardo Pinto','Corte masculino',-4,11,'completed','pix'),
      ('barbearia','Felipe Souza','Platinado',-3,15,'completed','cartao'),
      ('barbearia','Gabriel Rocha','Pézinho / Acabamento',-2,9,'completed','pix'),
      ('barbearia','Marcelo Dias','Corte + Barba',-2,16,'completed','dinheiro'),
      ('barbearia','Rafael Lima','Corte masculino',-1,10,'completed','cartao'),
      ('barbearia','Bruno Alves','Barba',0,14,'confirmed',null),
      ('barbearia','Diego Ramos','Corte masculino',0,16,'confirmed',null),
      ('barbearia','Carlos Nunes','Corte + Barba',1,9,'confirmed',null),
      ('barbearia','Felipe Souza','Corte infantil',1,15,'pending',null),
      ('barbearia','Eduardo Pinto','Hidratação capilar',2,10,'confirmed',null),
      ('barbearia','Gabriel Rocha','Corte masculino',3,11,'confirmed',null)
    ) as t(niche,cli,svc,doff,hr,st,pay)
    where t.niche = v_key
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
    values (p_salon, v_cid, v_member, r.st::appointment_status, v_start, v_end, v_price, 'panel',
            case when r.st = 'completed' then r.pay else null end)
    returning id into v_appt;

    insert into appointment_services (salon_id, appointment_id, service_id, name, duration_min, price, commission_percent, commission_amount)
    values (p_salon, v_appt, v_sid, r.svc, v_dur, v_price, v_comm, round(v_price * v_comm / 100, 2));
  end loop;
end;
$function$;
