-- ─────────────────────────────────────────────────────────────────────────
-- Selo "traga o próprio material" por serviço (ex.: manicure/pedicure).
-- Quando ligado, a página pública de agendamento mostra um aviso amigável
-- convidando a cliente a trazer seu alicate/esmalte de uso pessoal — deixando
-- claro que é opcional e que o salão segue todos os protocolos de higiene.
--
-- public_services passa a retornar a coluna. Como adicionar coluna ao
-- RETURNS TABLE muda a assinatura, é preciso DROP + CREATE (não dá CREATE OR
-- REPLACE). A função é só de leitura pública, sem dependências.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.services
  add column if not exists bring_own_tools boolean not null default false;

drop function if exists public.public_services(uuid);

create function public.public_services(p_salon uuid)
 returns table (
   id uuid,
   category_id uuid,
   name text,
   description text,
   duration_min integer,
   price numeric,
   price_type text,
   color text,
   bring_own_tools boolean
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select id, category_id, name, description, duration_min, price, price_type, color, bring_own_tools
  from services where salon_id = p_salon and is_active order by name;
$function$;

grant execute on function public.public_services(uuid) to anon, authenticated;
