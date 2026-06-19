-- ─────────────────────────────────────────────────────────────────────────
-- Aluguel de cadeira → comissão sempre 0
--
-- Quando o vínculo do profissional (salon_member_details.employment_type) é
-- 'chair_rent', ele paga pelo espaço e NÃO recebe comissão. Esta regra entra
-- no topo da cadeia de resolução (antes de serviço/membro), então não pode ser
-- furada por uma comissão padrão de serviço.
--
-- Afeta as 3 funções que calculam comissão:
--   • finalize_appointment  — comissão final do atendimento (autoritativa)
--   • redeem_package        — comissão no uso de pacote
--   • _appt_fill            — pré-preenchimento na criação do agendamento
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.finalize_appointment(p_appointment uuid, p_payment_method text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_salon uuid;
  v_member uuid;
  v_total numeric;
  v_status appointment_status;
  v_session uuid;
  v_comm_total numeric := 0;
  v_client text;
  v_cash_recorded boolean := false;
  v_warnings text[] := '{}';
  r record;
  v_newqty numeric;
  v_pname text;
BEGIN
  SELECT a.salon_id, a.member_id, a.total_price, a.status, c.full_name
    INTO v_salon, v_member, v_total, v_status, v_client
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  WHERE a.id = p_appointment;

  IF v_salon IS NULL THEN RAISE EXCEPTION 'appointment_not_found'; END IF;
  IF NOT is_salon_member(v_salon) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- 1) comissão por serviço (aluguel de cadeira = 0; senão professional_services > serviço > membro)
  UPDATE appointment_services asv SET
    commission_percent = eff.pct,
    commission_amount  = round(asv.price * eff.pct / 100.0, 2)
  FROM (
    SELECT x.id,
      case when d.employment_type = 'chair_rent' then 0
           else coalesce(ps.commission_percent, s.commission_percent, m.commission_percent, 0) end AS pct
    FROM appointment_services x
    LEFT JOIN professional_services ps ON ps.member_id = v_member AND ps.service_id = x.service_id
    LEFT JOIN services s ON s.id = x.service_id
    LEFT JOIN salon_members m ON m.id = v_member
    LEFT JOIN salon_member_details d ON d.member_id = v_member
    WHERE x.appointment_id = p_appointment
  ) eff
  WHERE asv.id = eff.id;

  SELECT coalesce(sum(commission_amount), 0) INTO v_comm_total
  FROM appointment_services WHERE appointment_id = p_appointment;

  -- 2) baixa automática de insumos (apenas na primeira finalização)
  IF v_status IS DISTINCT FROM 'completed' THEN
    FOR r IN
      SELECT sp.product_id, sum(sp.quantity) AS qty
      FROM appointment_services asv
      JOIN service_products sp ON sp.service_id = asv.service_id AND sp.salon_id = v_salon
      WHERE asv.appointment_id = p_appointment
      GROUP BY sp.product_id
    LOOP
      UPDATE products SET quantity = quantity - r.qty
       WHERE id = r.product_id
       RETURNING quantity, name INTO v_newqty, v_pname;
      INSERT INTO stock_movements (salon_id, product_id, type, quantity, reason, appointment_id, created_by)
      VALUES (v_salon, r.product_id, 'out', r.qty, 'Atendimento', p_appointment, auth.uid());
      IF v_newqty < 0 THEN
        v_warnings := array_append(v_warnings, v_pname);
      END IF;
    END LOOP;
  END IF;

  -- 3) conclui + forma de pagamento
  UPDATE appointments
     SET status = 'completed',
         payment_method = coalesce(p_payment_method, payment_method),
         updated_at = now()
   WHERE id = p_appointment;

  -- 4) receita no caixa (se sessão aberta e ainda não lançada)
  SELECT id INTO v_session FROM cash_sessions
   WHERE salon_id = v_salon AND closed_at IS NULL
   ORDER BY opened_at DESC LIMIT 1;

  IF v_session IS NOT NULL AND coalesce(v_total,0) > 0
     AND NOT EXISTS (SELECT 1 FROM cash_transactions WHERE appointment_id = p_appointment AND type = 'income') THEN
    INSERT INTO cash_transactions
      (salon_id, session_id, type, category, amount, payment_method, appointment_id, member_id, description, created_by)
    VALUES
      (v_salon, v_session, 'income', 'atendimento', v_total, p_payment_method, p_appointment, v_member,
       'Atendimento' || coalesce(' · ' || v_client, ''), auth.uid());
    v_cash_recorded := true;
  END IF;

  RETURN jsonb_build_object(
    'cash_recorded', v_cash_recorded,
    'commission_total', v_comm_total,
    'amount', coalesce(v_total, 0),
    'stock_warnings', to_jsonb(v_warnings)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.redeem_package(p_item uuid, p_member uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item client_package_items;
  v_pkg client_packages;
  v_pct numeric := 0;
  v_comm numeric := 0;
  v_all_used boolean;
begin
  select * into v_item from client_package_items where id = p_item;
  if not found then raise exception 'item_not_found'; end if;

  select * into v_pkg from client_packages where id = v_item.client_package_id;
  if not (has_permission(v_pkg.salon_id,'packages.manage')
          or (select owner_id from salons where id = v_pkg.salon_id) = auth.uid()) then
    raise exception 'forbidden';
  end if;
  if v_pkg.status <> 'active' then raise exception 'package_inactive'; end if;
  if v_pkg.expires_at < now() then
    update client_packages set status = 'expired' where id = v_pkg.id;
    raise exception 'package_expired';
  end if;
  if v_item.used >= v_item.total then raise exception 'item_exhausted'; end if;

  -- comissão: aluguel de cadeira = 0; senão professional_services > serviço > membro
  if p_member is not null then
    select case when d.employment_type = 'chair_rent' then 0
                else coalesce(ps.commission_percent, s.commission_percent, m.commission_percent, 0) end
      into v_pct
    from (select 1) x
    left join professional_services ps on ps.member_id = p_member and ps.service_id = v_item.service_id
    left join services s on s.id = v_item.service_id
    left join salon_members m on m.id = p_member
    left join salon_member_details d on d.member_id = p_member;
    v_comm := round(coalesce(v_item.unit_price,0) * coalesce(v_pct,0) / 100.0, 2);
  end if;

  update client_package_items set used = used + 1 where id = p_item;

  insert into package_redemptions (salon_id, client_package_id, item_id, member_id, commission_amount, created_by)
  values (v_pkg.salon_id, v_pkg.id, p_item, p_member, v_comm, auth.uid());

  -- conclui o pacote se todos os itens foram usados
  select bool_and(used >= total) into v_all_used from client_package_items where client_package_id = v_pkg.id;
  if v_all_used then
    update client_packages set status = 'completed' where id = v_pkg.id;
  end if;

  return jsonb_build_object('commission', v_comm, 'completed', coalesce(v_all_used,false));
end; $function$;

CREATE OR REPLACE FUNCTION public._appt_fill(p_salon uuid, p_appt uuid, p_member uuid, p_service_ids uuid[], p_starts_at timestamp with time zone, p_member_commission numeric)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; cur timestamptz := p_starts_at; bs timestamptz; be timestamptz; comm numeric;
  v_on date := (p_starts_at at time zone 'America/Sao_Paulo')::date; eff numeric;
  v_chair boolean := false;
begin
  v_chair := coalesce((select employment_type = 'chair_rent' from salon_member_details where member_id = p_member), false);
  for s in
    select id, name, duration_min, processing_time_min, finish_time_min, price, price_type, commission_percent
    from services where salon_id = p_salon and id = any(p_service_ids)
    order by array_position(p_service_ids, id)
  loop
    comm := case when v_chair then 0 else coalesce(s.commission_percent, p_member_commission, 0) end;
    eff  := effective_price(p_salon, s.id, s.price, s.price_type, v_on);
    insert into appointment_services (salon_id, appointment_id, service_id, name, duration_min, price, commission_percent, commission_amount)
    values (p_salon, p_appt, s.id, s.name,
            s.duration_min + s.processing_time_min + s.finish_time_min,
            eff, comm, round(eff * comm / 100, 2));

    if s.processing_time_min > 0 then
      bs := cur; be := cur + make_interval(mins => s.duration_min);
      insert into appointment_segments (salon_id, appointment_id, member_id, starts_at, ends_at)
      values (p_salon, p_appt, p_member, bs, be);
      if s.finish_time_min > 0 then
        bs := cur + make_interval(mins => s.duration_min + s.processing_time_min);
        be := bs + make_interval(mins => s.finish_time_min);
        insert into appointment_segments (salon_id, appointment_id, member_id, starts_at, ends_at)
        values (p_salon, p_appt, p_member, bs, be);
      end if;
      cur := cur + make_interval(mins => s.duration_min + s.processing_time_min + s.finish_time_min);
    else
      bs := cur; be := cur + make_interval(mins => s.duration_min + s.finish_time_min);
      insert into appointment_segments (salon_id, appointment_id, member_id, starts_at, ends_at)
      values (p_salon, p_appt, p_member, bs, be);
      cur := cur + make_interval(mins => s.duration_min + s.finish_time_min);
    end if;
  end loop;
  return cur;
end; $function$;
