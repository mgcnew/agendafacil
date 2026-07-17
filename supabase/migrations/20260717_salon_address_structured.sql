-- Endereço estruturado (Fase 1) — base pro SEO local e, mais adiante, pra
-- busca por proximidade.
--
-- Hoje `address` é um texto livre ("Rua Gregório Mafra 26", sem cidade), que
-- não dá pra geocodificar nem agrupar por bairro. O campo antigo continua
-- existindo como fallback do que já foi digitado; o que vale daqui pra frente
-- são os campos estruturados.
--
-- Privacidade: muita profissional de beleza atende em casa, então endereço é
-- decisão dela, não padrão do sistema. São dois controles separados de
-- propósito — mostrar o endereço na própria página de agendamento (que ela
-- mesma manda pra clientes) é diferente de aparecer num diretório para
-- estranhos:
--   address_visibility  → o que aparece na página pública dela
--   listed_in_directory → entrar (ou não) na busca por proximidade (Fase 3)
-- O diretório nasce DESLIGADO pra todo mundo: opt-in, nunca opt-out.
alter table public.salons
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists address_visibility text not null default 'full',
  add column if not exists listed_in_directory boolean not null default false;

alter table public.salons drop constraint if exists salons_address_visibility_check;
alter table public.salons add constraint salons_address_visibility_check
  check (address_visibility = any (array['full', 'neighborhood', 'hidden']));

-- Fase 3 vai filtrar por cidade/bairro antes de medir distância.
create index if not exists salons_city_idx on public.salons (lower(city))
  where listed_in_directory and is_active;

/**
 * public_salon — agora devolve o endereço estruturado, respeitando a escolha
 * da dona. O corte é aqui, no banco, e não na tela: com "só o bairro" a rua e
 * as coordenadas não saem nem pela API, então não adianta olhar o JSON.
 */
drop function if exists public.public_salon(text);
create function public.public_salon(p_slug text)
 returns table (
   id uuid, name text, slug text, niche salon_niche, color_theme text, theme jsonb,
   logo_url text, address text, phone text, is_demo boolean,
   street text, street_number text, complement text, neighborhood text,
   city text, state text, cep text, lat double precision, lng double precision,
   address_visibility text
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
    -- coordenada aponta a porta da casa: só sai com endereço completo liberado
    case when s.address_visibility = 'full' then s.lat end,
    case when s.address_visibility = 'full' then s.lng end,
    s.address_visibility
  from salons s
  where s.slug = p_slug and s.is_active
  limit 1;
$function$;
