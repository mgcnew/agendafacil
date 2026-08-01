-- Migração separada: `alter type ... add value` não pode ser usado na mesma
-- transação que cria o valor. Ver 20260730_atendimento_domicilio_3_kinds.sql.
--
-- home_quote → "o valor ficou assim; posso confirmar?". Ocupa o lugar que a
-- home_confirmed ocupava no fluxo; a home_confirmed passa a ser o que o nome
-- sempre disse — a mensagem de DEPOIS do sim.
alter type public.whatsapp_message_kind add value if not exists 'home_quote';
