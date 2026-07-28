-- ─────────────────────────────────────────────────────────────────────────
-- WhatsApp — tipos de mensagem da fase 2.
--
-- Migração separada de propósito: `alter type ... add value` não pode ser
-- usado na MESMA transação que criou o valor. Os novos tipos precisam existir
-- e estar commitados antes de 20260728_whatsapp_inbound.sql referenciá-los.
--
-- reminder_confirm e review_request já existiam desde o começo (o enum foi
-- desenhado prevendo a fase 2). Os três *_ack são novos: são RESPOSTAS a uma
-- mensagem que o cliente mandou, não disparos nossos.
--
-- Por que confirmar de volta importa: quem escreve "SAIR" e recebe silêncio
-- não sabe se funcionou — e a próxima ação de quem não sabe é Bloquear. O ack
-- fecha o ciclo. De quebra, conversa de duas vias é o padrão de uso que o
-- WhatsApp premia, o oposto do número que só dispara.
-- ─────────────────────────────────────────────────────────────────────────

alter type public.whatsapp_message_kind add value if not exists 'opt_out_ack';
alter type public.whatsapp_message_kind add value if not exists 'confirm_ack';
alter type public.whatsapp_message_kind add value if not exists 'decline_ack';
