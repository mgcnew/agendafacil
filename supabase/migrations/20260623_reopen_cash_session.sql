-- ─────────────────────────────────────────────────────────────────────────
-- Reabrir caixa fechado por engano.
-- Travas: só membro do salão; não pode haver outro caixa aberto; e só o
-- ÚLTIMO caixa fechado pode ser reaberto (evita corromper sessões antigas).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.reopen_cash_session(p_session uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid;
begin
  select salon_id into v_salon
  from cash_sessions
  where id = p_session and closed_at is not null;

  if v_salon is null then raise exception 'session_not_found'; end if;
  if not is_salon_member(v_salon) then raise exception 'forbidden'; end if;

  if exists (select 1 from cash_sessions where salon_id = v_salon and closed_at is null) then
    raise exception 'session_already_open';
  end if;

  if p_session <> (
    select id from cash_sessions
    where salon_id = v_salon and closed_at is not null
    order by closed_at desc limit 1
  ) then
    raise exception 'not_latest_session';
  end if;

  update cash_sessions
     set closed_at = null,
         closing_amount = null,
         expected_amount = null,
         difference = null,
         closed_by = null
   where id = p_session;

  return jsonb_build_object('reopened', true);
end; $function$;
