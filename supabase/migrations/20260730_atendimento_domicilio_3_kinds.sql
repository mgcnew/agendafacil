-- Migração separada: `alter type ... add value` não pode ser usado na mesma
-- transação que criou o valor. Precisa estar commitado antes de
-- 20260730_atendimento_domicilio_4_fluxo.sql referenciá-lo.
--
-- Dois tipos porque são dois momentos com promessas diferentes, e confundi-los
-- é justamente a surpresa que queremos evitar:
--
--   home_request   → "recebemos seu pedido". NÃO diz que está marcado, porque
--                    ainda não está: falta a profissional dizer se vai naquele
--                    endereço e naquele horário. O comprovante normal diria
--                    "está marcado" e o valor chegaria depois — exatamente a
--                    surpresa que o recurso existe pra evitar.
--
--   home_confirmed → "confirmado, e o deslocamento ficou R$ X". É a mensagem
--                    que fecha o combinado, com o número.
alter type public.whatsapp_message_kind add value if not exists 'home_request';
alter type public.whatsapp_message_kind add value if not exists 'home_confirmed';
