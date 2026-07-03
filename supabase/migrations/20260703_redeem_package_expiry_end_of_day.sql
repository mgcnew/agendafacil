-- ─────────────────────────────────────────────────────────────────────────
-- Vencimento de pacote passa a valer "até o fim do dia" (fuso America/Sao_Paulo).
--
-- Antes: expires_at < now() barrava o uso já no horário exato do vencimento —
-- um pacote que "vence hoje" (0 dias) deixava de funcionar no meio do dia,
-- enquanto o painel ainda mostrava o botão "Usar" e dava "Não foi possível
-- registrar o uso". Agora só expira quando a DATA de vencimento (BR) é anterior
-- a hoje, batendo com o que o dono vê no painel (daysUntilCalendarBR).
-- ─────────────────────────────────────────────────────────────────────────

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
  -- Vale o dia inteiro do vencimento: só expira quando a data (BR) já passou.
  if (v_pkg.expires_at at time zone 'America/Sao_Paulo')::date
       < (now() at time zone 'America/Sao_Paulo')::date then
    update client_packages set status = 'expired' where id = v_pkg.id;
    raise exception 'package_expired';
  end if;
  if v_item.used >= v_item.total then raise exception 'item_exhausted'; end if;

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

  select bool_and(used >= total) into v_all_used from client_package_items where client_package_id = v_pkg.id;
  if v_all_used then
    update client_packages set status = 'completed' where id = v_pkg.id;
  end if;

  return jsonb_build_object('commission', v_comm, 'completed', coalesce(v_all_used,false));
end; $function$;
