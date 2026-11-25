-- "Meus agendamentos" acha a cliente pelo telefone no formato gravado pelo
-- agendamento (+55DDDNÚMERO). Telefone fora desse formato nunca casa: a
-- pessoa abre a aba e não vê nada.
--
-- 1) Demo: o reset diário gravava os clientes fictícios sem o +55, então a
--    aba nunca funcionava na demonstração. Troca só esse trecho na definição
--    viva da função (ela já divergiu dos arquivos de migração antigos).
do $$
declare
  d text := pg_get_functiondef('public.reset_demo_salon(uuid)'::regprocedure);
  antes text := d;
begin
  d := replace(d, 'select p_salon, x.nome, x.fone,', 'select p_salon, x.nome, ''+55'' || x.fone,');
  if position('''+55'' || x.fone' in d) = 0 then
    raise exception 'reset_demo_salon: trecho dos clientes não encontrado; nada foi alterado';
  end if;
  if d <> antes then
    execute d;
  end if;
end $$;

update public.clients c
   set phone = '+55' || c.phone
  from public.salons s
 where s.id = c.salon_id and s.is_demo and c.phone ~ '^\d{10,11}$';

-- 2) Salões reais: telefone com 10 ou 11 dígitos escrito com espaço/traço
--    (cadastro antigo, antes da regra de formato) vai para o padrão — desde
--    que não exista outra cliente do mesmo salão com esse número. "+55" sem
--    número não tem o que recuperar: fica para o salão preencher.
update public.clients c
   set phone = '+55' || regexp_replace(c.phone, '\D', '', 'g')
 where c.phone is not null
   and c.phone !~ '^\+55\d{10,11}$'
   and length(regexp_replace(c.phone, '\D', '', 'g')) in (10, 11)
   and not exists (
     select 1 from public.clients o
      where o.salon_id = c.salon_id and o.id <> c.id
        and o.phone = '+55' || regexp_replace(c.phone, '\D', '', 'g')
   );
