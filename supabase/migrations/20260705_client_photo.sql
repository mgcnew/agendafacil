-- ─────────────────────────────────────────────────────────────────────────
-- Foto de perfil do cliente (registro). A equipe (permissão clients.manage)
-- sobe a foto na ficha do cliente; a Agenda mostra essa foto ao lado do
-- agendamento quando houver. Mesmo padrão de storage já usado pra foto de
-- profissional (bucket "logos", upload via server action/admin client).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.clients add column if not exists photo_url text;
