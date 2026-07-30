-- ─────────────────────────────────────────────────────────────────────────
-- Atendimento em domicílio — o que a página pública precisa saber.
--
-- A cliente NÃO vê o valor final no primeiro pedido: vê a REGRA ("R$ 5,00 o
-- primeiro km + R$ 2,00 por km adicional"). Isso é decisão de produto, não
-- limitação técnica disfarçada: quem decide se vai naquele endereço e naquele
-- horário é a profissional, e essa decisão nunca foi automática. O passo de
-- confirmação já existe no sistema (`pending` → `confirmed`) e é onde o valor
-- exato entra.
--
-- Da segunda vez em diante a mesma cliente vê o valor na hora, porque o km já
-- está guardado na ficha dela — e aí não há passo nenhum.
--
-- `home_terms` sai daqui também: as condições ("preciso de uma mesa firme e
-- tomada por perto") têm que ser lidas ANTES de agendar, não depois.
-- ─────────────────────────────────────────────────────────────────────────

-- ── public_salon ─────────────────────────────────────────────────────────
-- drop antes: `create or replace` não muda tipo de retorno (42P13).
drop function if exists public.public_salon(text);
create function public.public_salon(p_slug text)
 returns table (
   id uuid, name text, slug text, niche salon_niche, color_theme text, theme jsonb,
   logo_url text, address text, phone text, is_demo boolean,
   street text, street_number text, complement text, neighborhood text,
   city text, state text, cep text, lat double precision, lng double precision,
   address_visibility text, instagram text, facebook text, google_business text,
   home_service_enabled boolean, home_first_km_fee numeric,
   home_extra_km_fee numeric, home_max_km numeric, home_terms text
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select
    s.id, s.name, s.slug, s.niche, s.color_theme, s.theme, s.logo_url,
    case when s.address_visibility = 'full' then s.address end,
    s.phone, s.is_demo,
    case when s.address_visibility = 'full' then s.street end,
    case when s.address_visibility = 'full' then s.street_number end,
    case when s.address_visibility = 'full' then s.complement end,
    case when s.address_visibility in ('full', 'neighborhood') then s.neighborhood end,
    case when s.address_visibility in ('full', 'neighborhood') then s.city end,
    case when s.address_visibility in ('full', 'neighborhood') then s.state end,
    case when s.address_visibility = 'full' then s.cep end,
    case when s.address_visibility = 'full' then s.lat end,
    case when s.address_visibility = 'full' then s.lng end,
    s.address_visibility,
    s.instagram, s.facebook, s.google_business,
    s.home_service_enabled, s.home_first_km_fee, s.home_extra_km_fee,
    s.home_max_km, s.home_terms
  from salons s
  where s.slug = p_slug and s.is_active
  limit 1;
$function$;

-- ── public_services ──────────────────────────────────────────────────────
drop function if exists public.public_services(uuid);
create function public.public_services(p_salon uuid)
 returns table (
   id uuid, category_id uuid, name text, description text, duration_min integer,
   price numeric, price_type text, color text, bring_own_tools boolean,
   allows_home_service boolean
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select id, category_id, name, description, duration_min, price, price_type,
         color, bring_own_tools, allows_home_service
  from services where salon_id = p_salon and is_active order by name;
$function$;

-- ── Endereço e km da cliente que volta ───────────────────────────────────
/**
 * Devolve o que já sabemos de quem está agendando, para não pedir de novo o
 * que ela já informou. É o que torna a segunda visita instantânea: com
 * `distance_km` preenchido, a página mostra o valor exato na hora.
 *
 * Security definer com corte estreito de propósito: só telefone EXATO, só os
 * campos de endereço, e só do salão em questão. Não serve pra varrer a base —
 * quem digita um telefone só descobre o endereço de quem já é cliente daquele
 * salão com aquele número, que é exatamente o que ela mesma digitou.
 */
create or replace function public.public_home_address(p_salon uuid, p_phone text)
 returns table (
   cep text, street text, street_number text, complement text,
   neighborhood text, city text, state text, distance_km numeric, fee numeric
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select c.cep, c.street, c.street_number, c.complement,
         c.neighborhood, c.city, c.state, c.distance_km,
         home_service_fee(p_salon, c.distance_km)
  from clients c
  where c.salon_id = p_salon
    and normalize_br_phone(c.phone) = normalize_br_phone(p_phone)
    and normalize_br_phone(p_phone) is not null
  limit 1;
$function$;

grant execute on function public.public_home_address(uuid, text) to anon, authenticated;
