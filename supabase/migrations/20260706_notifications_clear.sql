-- ─────────────────────────────────────────────────────────────────────────
-- Permite o usuário limpar suas próprias notificações (botão "Limpar" no sino).
-- A tabela só tinha policies de SELECT e UPDATE (escopadas ao recipient_id);
-- sem DELETE, o RLS bloqueava a limpeza. Mesma condição de posse das demais.
-- ─────────────────────────────────────────────────────────────────────────

create policy notif_delete on public.notifications
  for delete
  using (recipient_id = (select auth.uid()));
