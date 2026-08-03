-- ─────────────────────────────────────────────────────────────────────────
-- As duas listas cresciam sem teto.
--
-- A aba da dona carregava o histórico inteiro a cada abertura, e o painel do
-- admin carregava TODAS as sugestões de TODOS os salões. Com doze linhas
-- ninguém percebe; o problema aparece quando já é tarde, porque cresce um
-- pouquinho por semana e nunca há um dia em que "ficou lento".
--
-- Limite com página seguinte, e não `limit` fixo: cortar em 50 e nunca mais
-- mostrar o resto transformaria o arquivo em amnésia — e o arquivo é o
-- recurso. O botão "Mostrar mais" mantém tudo alcançável sem carregar tudo.
--
-- DROP ANTES: acrescentar parâmetro com default cria SOBRECARGA, não
-- substituição. Com as duas assinaturas no ar, a chamada sem argumentos que o
-- painel já fazia viraria "function is not unique". Mesma pedra do
-- set_appointment_travel em 20260731_domicilio_deslocamento.sql.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.admin_list_updates();
create or replace function public.admin_list_updates(
  p_limit integer default 20,
  p_offset integer default 0
) returns setof public.product_updates
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
    select * from product_updates
    -- Em construção primeiro: é o que está na mão agora.
    order by (status = 'building') desc, coalesce(shipped_at, created_at) desc
    limit greatest(coalesce(p_limit, 20), 1)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

drop function if exists public.admin_list_suggestions();
create or replace function public.admin_list_suggestions(
  p_limit integer default 20,
  p_offset integer default 0
) returns table (
   id uuid, salon_id uuid, salon_name text, author_name text,
   body text, status text, reply text, update_id uuid, update_title text,
   created_at timestamptz, updated_at timestamptz
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
    select s.id, s.salon_id, sa.name, coalesce(p.full_name, p.email),
           s.body, s.status, s.reply, s.update_id, u.title,
           s.created_at, s.updated_at
    from product_suggestions s
    join salons sa on sa.id = s.salon_id
    left join profiles p on p.id = s.author_id
    left join product_updates u on u.id = s.update_id
    -- Sem resposta primeiro: a fila é do que ainda não foi respondido, e ela
    -- não pode escorregar pra terceira página conforme o histórico cresce.
    order by (s.status = 'recebida') desc, s.created_at desc
    limit greatest(coalesce(p_limit, 20), 1)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

revoke execute on function public.admin_list_updates(integer, integer) from public, anon;
revoke execute on function public.admin_list_suggestions(integer, integer) from public, anon;
grant execute on function public.admin_list_updates(integer, integer) to authenticated;
grant execute on function public.admin_list_suggestions(integer, integer) to authenticated;
