-- Trial de 14 dias — a landing promete "14 dias grátis, sem cartão" em vários
-- pontos, mas o salão novo nascia com 5: o trigger insere só o salon_id e o
-- resto vinha do default da coluna, que estava em 5 dias. Os salões atuais têm
-- trial esticado na mão (35/126d), então o furo nunca apareceu — quem pagaria
-- o pato era o próximo cadastro vindo do anúncio.
--
-- O prazo agora fica explícito no trigger (quem lê a função vê a regra) e o
-- default da coluna acompanha, pra insert direto não voltar a divergir.
alter table public.salon_subscriptions
  alter column trial_ends_at set default (now() + interval '14 days');

create or replace function public.handle_new_salon_subscription()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.salon_subscriptions (salon_id, trial_ends_at)
  values (new.id, now() + interval '14 days')
  on conflict (salon_id) do nothing;
  return new;
end;
$function$;
