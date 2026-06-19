-- ─────────────────────────────────────────────────────────────────────────
-- Agregados por cliente para a lista de Clientes
--
-- Uma linha por cliente com atendimentos CONCLUÍDOS: nº de visitas, total gasto
-- e data da última visita. Usado para mostrar "última visita" e filtrar
-- clientes "sumidas" (sem voltar há X dias) para campanhas de reativação.
--
-- SECURITY DEFINER + guarda is_salon_member: retorna vazio se o chamador não
-- for membro do salão (sem vazar dados de outro salão).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.clients_overview(p_salon uuid)
returns table (client_id uuid, visits bigint, total_spent numeric, last_visit timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.client_id,
         count(*)                      as visits,
         coalesce(sum(a.total_price),0) as total_spent,
         max(a.starts_at)              as last_visit
  from appointments a
  where a.salon_id = p_salon
    and a.status = 'completed'
    and a.client_id is not null
    and is_salon_member(p_salon)
  group by a.client_id;
$$;

grant execute on function public.clients_overview(uuid) to authenticated;
