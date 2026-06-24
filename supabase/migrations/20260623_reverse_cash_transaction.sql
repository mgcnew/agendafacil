-- ─────────────────────────────────────────────────────────────────────────
-- Estorno de movimentação de caixa.
-- • Cobrança de atendimento (income + appointment_id): remove as entradas e
--   libera o atendimento para nova cobrança (reaparece em "Receber"). O estoque
--   permanece baixado; ao recobrar, finalize_appointment não baixa de novo pois
--   o status segue 'completed'.
-- • Lançamento avulso (manual / sangria / suprimento): apenas remove.
-- Só permite estorno enquanto a sessão de caixa estiver aberta.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.reverse_cash_transaction(p_tx uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid;
  v_session uuid;
  v_appt uuid;
  v_type cash_tx_type;
  v_closed timestamptz;
begin
  select t.salon_id, t.session_id, t.appointment_id, t.type
    into v_salon, v_session, v_appt, v_type
  from cash_transactions t
  where t.id = p_tx;

  if v_salon is null then raise exception 'tx_not_found'; end if;
  if not is_salon_member(v_salon) then raise exception 'forbidden'; end if;

  -- estorno só em sessão aberta (não corrompe relatório de caixa já fechado)
  select closed_at into v_closed from cash_sessions where id = v_session;
  if v_closed is not null then raise exception 'session_closed'; end if;

  if v_appt is not null and v_type = 'income' then
    -- estorno de cobrança: remove todas as entradas do atendimento e libera p/ recobrar
    delete from cash_transactions where appointment_id = v_appt and type = 'income';
    update appointments set payment_method = null, updated_at = now() where id = v_appt;
  else
    -- lançamento avulso
    delete from cash_transactions where id = p_tx;
  end if;

  return jsonb_build_object('reversed', true, 'appointment', v_appt);
end; $function$;
