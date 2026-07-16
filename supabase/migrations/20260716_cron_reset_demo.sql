-- Reset automático dos salões demo toda madrugada (03:00 America/Sao_Paulo =
-- 06:00 UTC). Recria a agenda/caixa "da semana" e limpa o que os prospects
-- mexeram. Requer pg_cron (já instalado). Reagendar pelo mesmo nome atualiza.
select cron.schedule(
  'reset-demo-salons',
  '0 6 * * *',
  $$select public.reset_demo_salon(id) from public.salons where is_demo$$
);
