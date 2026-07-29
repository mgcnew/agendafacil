-- Migração separada: `alter type ... add value` não pode ser usado na mesma
-- transação que criou o valor. Precisa existir e estar commitado antes de
-- 20260729_whatsapp_opt_in.sql referenciá-lo.
alter type public.whatsapp_message_kind add value if not exists 'opt_in_ack';
