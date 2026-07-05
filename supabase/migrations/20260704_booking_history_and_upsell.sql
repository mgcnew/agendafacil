-- ─────────────────────────────────────────────────────────────────────────
-- Suporte à reformulação da página pública de agendamento (/[slug]):
--
-- 1. public_my_appointments: unifica my_appointments + public_appointments_by_phone
--    num único RPC (cliente logado OU telefone), já trazendo member_id (para
--    calcular o profissional favorito no cliente) — sem alterar as functions
--    antigas, que não têm migration local rastreada (schema base pré-existente).
--
-- 2. public_resale_products: sugestão de produtos de revenda (estoque) para
--    oferecer junto do serviço escolhido. "linked" indica que o produto já
--    está cadastrado como insumo (service_products) de algum serviço escolhido.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.public_my_appointments(
  p_salon uuid,
  p_phone text default null
)
 returns table (
   id uuid,
   salon_id uuid,
   salon_name text,
   member_id uuid,
   member_name text,
   status appointment_status,
   starts_at timestamptz,
   ends_at timestamptz,
   total_price numeric,
   services text[]
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.id, a.salon_id, sl.name as salon_name,
    a.member_id,
    coalesce(sm.display_name, pr.full_name) as member_name,
    a.status, a.starts_at, a.ends_at, a.total_price,
    array(select name from appointment_services where appointment_id = a.id) as services
  from appointments a
  join salons sl on sl.id = a.salon_id
  join salon_members sm on sm.id = a.member_id
  join profiles pr on pr.id = sm.profile_id
  join clients c on c.id = a.client_id
  where a.salon_id = p_salon
    and (
      (auth.uid() is not null and c.profile_id = auth.uid())
      or (p_phone is not null and c.phone = p_phone)
    )
  order by a.starts_at desc;
$function$;

grant execute on function public.public_my_appointments(uuid, text) to anon, authenticated;

create or replace function public.public_resale_products(
  p_salon uuid,
  p_service_ids uuid[] default '{}'
)
 returns table (
   id uuid,
   name text,
   sale_price numeric,
   unit text,
   linked boolean
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select
    p.id,
    p.name,
    p.sale_price,
    p.unit,
    exists (
      select 1 from service_products sp
      where sp.product_id = p.id
        and sp.service_id = any(p_service_ids)
    ) as linked
  from products p
  where p.salon_id = p_salon
    and p.is_resale = true
    and p.is_active = true
    and p.quantity > 0
  order by linked desc, p.name asc;
$function$;

grant execute on function public.public_resale_products(uuid, uuid[]) to anon, authenticated;
