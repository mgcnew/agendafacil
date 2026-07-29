-- Migração separada: `alter type ... add value` não pode ser usado na mesma
-- transação que criou o valor. Precisa existir e estar commitado antes de
-- 20260729_whatsapp_winback_2.sql referenciá-lo.
--
-- Três tipos e não um "winback" só: o motivo do sumiço é a informação mais
-- importante da mensagem. Quem faltou não pode receber o mesmo texto de quem
-- cancelou com antecedência — um se sente cobrado, o outro se sente esquecido.
alter type public.whatsapp_message_kind add value if not exists 'winback_no_show';
alter type public.whatsapp_message_kind add value if not exists 'winback_cancelled';
alter type public.whatsapp_message_kind add value if not exists 'winback_inactive';
