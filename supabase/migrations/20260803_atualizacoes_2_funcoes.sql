-- ─────────────────────────────────────────────────────────────────────────
-- As funções das atualizações. Escrita só por admin da plataforma, no mesmo
-- desenho do platform_announcements: RPC SECURITY DEFINER que checa
-- is_platform_admin() e deixa rastro no admin_audit_log.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Novidade não lida ────────────────────────────────────────────────────
/**
 * O que entrou no ar depois da última vez que esta pessoa olhou.
 *
 * O `coalesce` com a data de criação do perfil é o detalhe que evita o
 * desastre: quem cadastra o salão hoje tem `updates_seen_at` nulo e receberia
 * o histórico inteiro como "novidade" — quarenta itens de coisas que
 * aconteceram antes de ela existir. Novidade é o que mudou desde que ela
 * chegou, não desde que o produto nasceu.
 */
create or replace function public.unseen_product_updates()
 returns setof public.product_updates
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select u.*
  from product_updates u
  where u.status = 'shipped'
    and u.shipped_at > coalesce(
      (select coalesce(p.updates_seen_at, p.created_at) from profiles p where p.id = auth.uid()),
      now()
    )
  order by u.shipped_at desc
  limit 5;
$function$;

revoke execute on function public.unseen_product_updates() from public, anon;
grant execute on function public.unseen_product_updates() to authenticated;

/** "Já vi." Marca o ponto de leitura no perfil de quem está logado. */
create or replace function public.mark_product_updates_seen()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update profiles set updates_seen_at = now() where id = auth.uid();
$function$;

revoke execute on function public.mark_product_updates_seen() from public, anon;
grant execute on function public.mark_product_updates_seen() to authenticated;

-- ── Freio da caixa de sugestão ───────────────────────────────────────────
/**
 * Dez por salão por dia. Não é desconfiança: é que uma tela de texto livre
 * sem limite nenhum é onde um script de teste (ou um clique repetido no
 * "Enviar" que não deu retorno) enche a tabela sem ninguém notar.
 */
create or replace function public.product_suggestions_freio()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if (
    select count(*) from product_suggestions
    where salon_id = NEW.salon_id and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'muitas_sugestoes';
  end if;
  return NEW;
end;
$function$;

drop trigger if exists product_suggestions_freio on public.product_suggestions;
create trigger product_suggestions_freio
  before insert on public.product_suggestions
  for each row execute function public.product_suggestions_freio();

revoke execute on function public.product_suggestions_freio() from public, anon, authenticated;

-- ── Admin: escrever o histórico ──────────────────────────────────────────
create or replace function public.admin_list_updates()
 returns setof public.product_updates
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  -- Em construção primeiro: é o que está na mão agora.
  return query
    select * from product_updates
    order by (status = 'building') desc, coalesce(shipped_at, created_at) desc;
end;
$function$;

/** Cria (p_id nulo) ou edita. Nasce sempre em construção. */
create or replace function public.admin_save_update(
  p_id uuid,
  p_title text,
  p_body text,
  p_kind text
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'titulo_vazio'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'texto_vazio'; end if;

  if p_id is null then
    insert into product_updates (title, body, kind, created_by)
    values (btrim(p_title), btrim(p_body), coalesce(nullif(p_kind, ''), 'novidade'), auth.uid())
    returning id into v_id;
  else
    update product_updates set
      title = btrim(p_title),
      body = btrim(p_body),
      kind = coalesce(nullif(p_kind, ''), kind)
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'nao_encontrado'; end if;
  end if;

  insert into admin_audit_log (actor, action, detail)
  values (auth.uid(), 'save_product_update',
          jsonb_build_object('id', v_id, 'title', left(btrim(p_title), 80)));
  return v_id;
end;
$function$;

/**
 * Entrega. A partir daqui a linha é história e ganha data.
 *
 * Fecha junto toda sugestão que estava apontada para esta entrega: quem pediu
 * passa a 'entregue' no mesmo movimento. Fazer isso na mão, item por item,
 * seria o passo que se esquece — e a sugestão esquecida em 'em_construcao'
 * para sempre é exatamente o silêncio que este recurso veio combater.
 */
create or replace function public.admin_ship_update(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;

  update product_updates
  set status = 'shipped', shipped_at = coalesce(shipped_at, now())
  where id = p_id;
  if not found then raise exception 'nao_encontrado'; end if;

  update product_suggestions
  set status = 'entregue', updated_at = now()
  where update_id = p_id and status <> 'entregue';

  insert into admin_audit_log (actor, action, detail)
  values (auth.uid(), 'ship_product_update', jsonb_build_object('id', p_id));
end;
$function$;

create or replace function public.admin_delete_update(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  delete from product_updates where id = p_id;
  insert into admin_audit_log (actor, action, detail)
  values (auth.uid(), 'delete_product_update', jsonb_build_object('id', p_id));
end;
$function$;

-- ── Admin: triar as sugestões ────────────────────────────────────────────
create or replace function public.admin_list_suggestions()
 returns table (
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
    -- Sem resposta primeiro: a fila é do que ainda não foi respondido.
    order by (s.status = 'recebida') desc, s.created_at desc;
end;
$function$;

/**
 * Move a sugestão e escreve a resposta.
 *
 * `nao_planejada` sem motivo é recusado pelo CHECK da tabela, não aqui: a
 * regra vale mesmo se alguém escrever direto no banco um dia.
 */
create or replace function public.admin_set_suggestion_status(
  p_id uuid,
  p_status text,
  p_reply text default null,
  p_update uuid default null
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;

  update product_suggestions set
    status = p_status,
    reply = coalesce(nullif(btrim(coalesce(p_reply, '')), ''), reply),
    update_id = coalesce(p_update, update_id),
    updated_at = now()
  where id = p_id;
  if not found then raise exception 'nao_encontrado'; end if;

  insert into admin_audit_log (actor, action, detail)
  values (auth.uid(), 'set_suggestion_status',
          jsonb_build_object('id', p_id, 'status', p_status));
end;
$function$;

revoke execute on function public.admin_list_updates() from public, anon;
revoke execute on function public.admin_save_update(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_ship_update(uuid) from public, anon;
revoke execute on function public.admin_delete_update(uuid) from public, anon;
revoke execute on function public.admin_list_suggestions() from public, anon;
revoke execute on function public.admin_set_suggestion_status(uuid, text, text, uuid) from public, anon;

grant execute on function public.admin_list_updates() to authenticated;
grant execute on function public.admin_save_update(uuid, text, text, text) to authenticated;
grant execute on function public.admin_ship_update(uuid) to authenticated;
grant execute on function public.admin_delete_update(uuid) to authenticated;
grant execute on function public.admin_list_suggestions() to authenticated;
grant execute on function public.admin_set_suggestion_status(uuid, text, text, uuid) to authenticated;
