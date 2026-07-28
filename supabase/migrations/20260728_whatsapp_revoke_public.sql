-- ─────────────────────────────────────────────────────────────────────────
-- Correção de segurança: tirar EXECUTE de PUBLIC nas funções do WhatsApp.
--
-- As migrations anteriores faziam `revoke execute ... from anon, authenticated`
-- achando que isso bastava. Não basta: o Postgres concede `EXECUTE TO PUBLIC`
-- por padrão em toda função nova, e anon/authenticated HERDAM de PUBLIC.
-- Revogar dos papéis nominalmente não mexe nessa herança — a ACL continuava
-- com `=X/postgres` (o "=" sem nome é PUBLIC) e qualquer visitante anônimo
-- seguia podendo chamar.
--
-- O que estava exposto:
--   · whatsapp_claim_next  → devolve linhas da outbox, ou seja TELEFONE e
--                            texto das mensagens de clientes. Vazamento.
--   · whatsapp_mark_result → marcar falha repetida abre o circuit breaker e
--                            pausa o WhatsApp do salão. Sabotagem.
--   · whatsapp_enqueue / drain / unstick → mexer na fila.
--
-- Revogar de PUBLIC é seguro: quem chama de verdade é o trigger (roda como
-- dono da tabela), o pg_cron (postgres) e a Edge Function (service_role) —
-- e os três têm concessão própria, não dependem de PUBLIC.
-- ─────────────────────────────────────────────────────────────────────────

revoke execute on function public.whatsapp_claim_next(int) from public;
revoke execute on function public.whatsapp_mark_result(uuid, boolean, text, text) from public;
revoke execute on function public.whatsapp_enqueue(uuid, public.whatsapp_message_kind, interval) from public;
revoke execute on function public.whatsapp_on_appointment() from public;
revoke execute on function public.whatsapp_drain() from public;
revoke execute on function public.whatsapp_unstick() from public;
revoke execute on function public.whatsapp_render(public.whatsapp_message_kind, uuid) from public;

-- Estas duas não têm efeito colateral (uma formata telefone, a outra faz
-- conta de data), mas também não servem a ninguém fora do sistema.
revoke execute on function public.normalize_br_phone(text) from public;
revoke execute on function public.whatsapp_daily_allowance(timestamptz, int) from public;

-- Revogar de PUBLIC não basta para estas três: o Supabase concede EXECUTE a
-- anon/authenticated NOMINALMENTE (default privileges do schema public), e
-- concessão nominal sobrevive ao revoke de PUBLIC. Precisa das duas.
revoke execute on function public.whatsapp_render(public.whatsapp_message_kind, uuid) from anon, authenticated;
revoke execute on function public.normalize_br_phone(text) from anon, authenticated;
revoke execute on function public.whatsapp_daily_allowance(timestamptz, int) from anon, authenticated;

-- search_path fixo: sem isso, um schema no caminho de busca do chamador pode
-- sequestrar a resolução de nomes dentro da função.
alter function public.normalize_br_phone(text) set search_path = 'public';
alter function public.whatsapp_daily_allowance(timestamptz, int) set search_path = 'public';
