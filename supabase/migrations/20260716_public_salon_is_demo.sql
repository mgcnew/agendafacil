-- Expõe is_demo na RPC pública do salão, pra a página pública mostrar o
-- banner "crie o seu teste" só nos salões demo. Drop+create porque muda o
-- tipo de retorno da função.
drop function if exists public.public_salon(text);

create function public.public_salon(p_slug text)
 returns table(id uuid, name text, slug text, niche salon_niche, color_theme text, theme jsonb, logo_url text, address text, phone text, is_demo boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select id, name, slug, niche, color_theme, theme, logo_url, address, phone, is_demo
  from salons
  where slug = p_slug and is_active
  limit 1;
$function$;
