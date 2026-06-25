-- ─────────────────────────────────────────────────────────────────────────
-- Recuperar clientes (win-back): monta três grupos para remarketing.
--   • no_shows : clientes que faltaram na janela (p_window_days), 1 por cliente
--                (falta mais recente), com total de faltas (selo de risco).
--   • cancelled: clientes que cancelaram na janela, sem agendamento futuro.
--   • inactive : última visita concluída há mais de p_inactive_days, sem futuro.
-- Telefone vem em E164; o front monta o link wa.me.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.marketing_winback(
  p_salon uuid,
  p_window_days int default 60,
  p_inactive_days int default 45
)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_no_shows jsonb;
  v_cancelled jsonb;
  v_inactive jsonb;
begin
  if not (has_permission(p_salon, 'clients.view')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  -- Faltaram (na janela): 1 linha por cliente, com total de faltas (todas as datas).
  with ns as (
    select a.client_id, max(a.starts_at) as last_at, count(*) as cnt
    from appointments a
    where a.salon_id = p_salon and a.status = 'no_show'
      and a.starts_at >= v_now - make_interval(days => p_window_days)
    group by a.client_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'client_id', c.id, 'name', c.full_name, 'phone', c.phone,
           'last_at', ns.last_at, 'recent', ns.cnt,
           'total_no_shows', (select count(*) from appointments a2
                              where a2.client_id = c.id and a2.salon_id = p_salon and a2.status = 'no_show')
         ) order by ns.last_at desc), '[]'::jsonb)
    into v_no_shows
  from ns join clients c on c.id = ns.client_id;

  -- Cancelaram (na janela): 1 por cliente, excluindo quem já tem horário futuro.
  with cc as (
    select a.client_id, max(a.starts_at) as last_at, count(*) as cnt
    from appointments a
    where a.salon_id = p_salon and a.status = 'cancelled'
      and a.starts_at >= v_now - make_interval(days => p_window_days)
    group by a.client_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'client_id', c.id, 'name', c.full_name, 'phone', c.phone,
           'last_at', cc.last_at, 'recent', cc.cnt
         ) order by cc.last_at desc), '[]'::jsonb)
    into v_cancelled
  from cc join clients c on c.id = cc.client_id
  where not exists (
    select 1 from appointments f
    where f.client_id = c.id and f.salon_id = p_salon
      and f.status in ('pending', 'confirmed', 'in_progress') and f.starts_at >= v_now
  );

  -- Inativos: última visita concluída há mais de p_inactive_days, sem horário futuro.
  with done as (
    select a.client_id, max(a.starts_at) as last_at,
           count(*) filter (where a.status = 'completed') as visits
    from appointments a
    where a.salon_id = p_salon and a.status = 'completed'
    group by a.client_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'client_id', c.id, 'name', c.full_name, 'phone', c.phone,
           'last_at', done.last_at, 'visits', done.visits
         ) order by done.last_at asc), '[]'::jsonb)
    into v_inactive
  from done join clients c on c.id = done.client_id
  where done.last_at < v_now - make_interval(days => p_inactive_days)
    and not exists (
      select 1 from appointments f
      where f.client_id = c.id and f.salon_id = p_salon
        and f.status in ('pending', 'confirmed', 'in_progress') and f.starts_at >= v_now
    );

  return jsonb_build_object(
    'no_shows', v_no_shows,
    'cancelled', v_cancelled,
    'inactive', v_inactive
  );
end;
$function$;

grant execute on function public.marketing_winback(uuid, int, int) to authenticated;
