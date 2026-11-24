-- "Cancele quando quiser" sem perder o mês pago. O cancelamento agora para a
-- cobrança no Asaas na hora, mas o salão segue com acesso até o fim do período
-- já pago (current_period_end). Antes, status 'canceled' bloqueava o painel
-- no mesmo instante.
--
-- Estorno/contestação gravam current_period_end = now(), então nesses casos o
-- acesso acaba na hora, como deve.
create or replace function public.salon_access_status(p_slug text)
 returns table(status text, trial_ends_at timestamp with time zone, current_period_end timestamp with time zone, has_access boolean, plan text, effective_plan text, pending_plan text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select
    sub.status,
    sub.trial_ends_at,
    sub.current_period_end,
    (sub.status = 'active'
     or (sub.status = 'trialing' and sub.trial_ends_at > now())
     or (sub.status = 'canceled' and sub.current_period_end > now())) as has_access,
    sub.plan,
    case
      when sub.status = 'active' then sub.plan
      when sub.status = 'trialing' and sub.trial_ends_at > now() then 'pro'
      when sub.status = 'canceled' and sub.current_period_end > now() then sub.plan
      else null
    end as effective_plan,
    sub.pending_plan
  from public.salons s
  join public.salon_subscriptions sub on sub.salon_id = s.id
  where s.slug = p_slug
    and exists (
      select 1 from public.salon_members m
      where m.salon_id = s.id and m.profile_id = (select auth.uid())
    );
$function$;
