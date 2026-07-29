-- ─────────────────────────────────────────────────────────────────────────
-- Redes sociais do salão na página pública.
--
-- Guarda o texto CRU que o dono digitou, não a URL montada. Ele vai digitar
-- "@barbeariamarcos" num dia e colar o link inteiro com ?igsh=... no outro —
-- normalizar na leitura (src/lib/social.ts) deixa o campo perdoar os dois sem
-- reescrever o que a pessoa escreveu. Vazio some da página sozinho.
--
-- google_business é diferente das outras duas: não existe "usuário" que dê
-- pra completar, então só vale link vindo do próprio Google. Sem link, não
-- há botão — adivinhar levaria o cliente pra ficha de outro negócio.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.salons
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists google_business text;

-- A página pública lê só pelo public_salon (security definer): sem incluir
-- aqui, os campos existiriam no banco e não chegariam na tela.
--
-- DROP antes do CREATE porque `create or replace` não muda o tipo de retorno
-- de uma função que já existe — e colunas novas mudam o tipo. Tudo dentro da
-- mesma transação, então a função nunca fica ausente para quem chama.
drop function if exists public.public_salon(text);

create or replace function public.public_salon(p_slug text)
 returns table(
   id uuid, name text, slug text, niche salon_niche, color_theme text,
   theme jsonb, logo_url text, address text, phone text, is_demo boolean,
   street text, street_number text, complement text, neighborhood text,
   city text, state text, cep text, lat double precision, lng double precision,
   address_visibility text,
   instagram text, facebook text, google_business text
 )
 language sql
 stable security definer
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
    -- Rede social é público por vontade do dono: não segue a regra de
    -- visibilidade do endereço, que existe pra proteger atendimento em casa.
    s.instagram, s.facebook, s.google_business
  from salons s
  where s.slug = p_slug and s.is_active
  limit 1;
$function$;
