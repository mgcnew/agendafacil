-- Nome do dono/responsável do salão no pipeline de prospecção — opcional.
-- Usado pelos templates de WhatsApp pra chamar a pessoa pelo nome
-- ("Oi, Marcos!") em vez de falar só com o salão.
alter table public.growth_leads add column if not exists owner_name text;
