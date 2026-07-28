-- ─────────────────────────────────────────────────────────────────────────
-- Marca quando o webhook de entrada foi apontado pra nós naquela instância.
--
-- Sem isto, a instância que já estava conectada antes de o webhook existir
-- nunca receberia a configuração: `setWebhook` rodava só na TRANSIÇÃO de
-- estado, e instância conectada não transiciona. Ela ficaria enviando pra
-- sempre sem nunca receber resposta — inclusive sem receber os "SAIR".
--
-- Com a marca, a rota /api/whatsapp/status conserta sozinha na próxima visita
-- ao painel, e a coluna evita repetir a chamada a cada polling de 3s.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.whatsapp_instances
  add column if not exists webhook_set_at timestamptz;

comment on column public.whatsapp_instances.webhook_set_at is
  'Quando /webhook/set foi aplicado na Evolution. Null = precisa aplicar.';
