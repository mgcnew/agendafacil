-- ─────────────────────────────────────────────────────────────────────────
-- Prospecção (pipeline de vendas do dono do SaaS)
-- Rastreador pessoal de divulgação: cada salão abordado vira uma linha, com o
-- canal de origem (porta a porta, indicação, Instagram…) e a etapa no funil.
-- Alimenta o resumo por canal do painel /admin → aba "Prospecção".
--
-- É dado do dono da plataforma, não de salão. Por isso a RLS restringe tudo a
-- quem é platform_admin (mesma checagem das RPCs de admin). O cliente logado
-- lê/escreve direto na tabela — não precisa de RPC SECURITY DEFINER.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                  -- nome do salão / prospect
  neighborhood text,                                   -- bairro / região
  channel text not null default 'porta_a_porta'
    check (channel in ('porta_a_porta','indicacao','instagram','whatsapp','google','parceria','outro')),
  stage text not null default 'abordado'
    -- 'a_visitar' = lista fria importada (ainda não abordada); o resto é o funil.
    check (stage in ('a_visitar','abordado','demo','testando','pagante','perdido')),
  contact text,                                        -- whatsapp / telefone
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.growth_leads enable row level security;

-- Só o admin da plataforma vê e gerencia seu próprio pipeline.
drop policy if exists "platform admins manage leads" on public.growth_leads;
create policy "platform admins manage leads" on public.growth_leads
  for all
  using (is_platform_admin())
  with check (is_platform_admin());

create index if not exists growth_leads_stage_idx on public.growth_leads (stage);
create index if not exists growth_leads_channel_idx on public.growth_leads (channel);

-- Toca updated_at em cada atualização.
create or replace function public.growth_leads_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists growth_leads_set_updated on public.growth_leads;
create trigger growth_leads_set_updated
  before update on public.growth_leads
  for each row execute function public.growth_leads_touch();
