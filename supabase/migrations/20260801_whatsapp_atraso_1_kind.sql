-- Migração separada: `alter type ... add value` não pode ser usado na mesma
-- transação que cria o valor. Ver 20260730_atendimento_domicilio_3_kinds.sql.
alter type public.whatsapp_message_kind add value if not exists 'late_nudge';
