-- Migração separada: `alter type ... add value` não pode ser usado na mesma
-- transação que criou o valor. Rodar ESTE arquivo primeiro, sozinho, e só
-- depois o 20261022_whatsapp_automacoes_2.sql.
alter type public.whatsapp_message_kind add value if not exists 'birthday';
alter type public.whatsapp_message_kind add value if not exists 'waitlist_open';
alter type public.whatsapp_message_kind add value if not exists 'service_return';
alter type public.whatsapp_message_kind add value if not exists 'package_reminder';
