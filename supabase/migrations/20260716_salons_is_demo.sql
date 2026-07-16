-- Flag de salão demo (conta de demonstração pública pra vendas).
-- Salões demo são isentos de cobrança/trial e NÃO contam nas métricas do
-- painel /admin (MRR, conversão, churn, listagem). Resetados por pg_cron.
alter table public.salons add column if not exists is_demo boolean not null default false;
