-- ─────────────────────────────────────────────────────────────────────────
-- Divulgação por IA — créditos de imagem + histórico de gerações
--
-- Aplicar quando for concluir a integração com a OpenAI. Antes disso, a UI
-- roda em "modo prévia" (ver src/lib/marketing/credits.ts), então nada quebra.
--
-- Modelo de créditos:
--   • monthly_quota   = cota mensal do plano (Max = 20), zera a cada mês.
--   • used_this_month = quanto já usou no ciclo (cycle_month).
--   • addon_balance   = pacotes adicionais comprados (+10), NÃO expiram.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_credits (
  salon_id        uuid primary key references public.salons(id) on delete cascade,
  monthly_quota   integer not null default 20,
  used_this_month integer not null default 0,
  addon_balance   integer not null default 0,
  cycle_month     text    not null default to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'),
  updated_at      timestamptz not null default now()
);

create table if not exists public.ai_generations (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  created_by  uuid references public.profiles(id),
  asset_type  text not null,                 -- 'service' | 'promotion' | 'client_work'
  format      text not null,                 -- 'story' | 'feed' | 'facebook'
  style       text not null,
  prompt      text,
  caption     text,
  image_path  text,                          -- caminho no Storage (bucket 'marketing')
  created_at  timestamptz not null default now()
);

create index if not exists ai_generations_salon_idx
  on public.ai_generations (salon_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- NOTE: ajuste o predicado de membro ao helper usado no resto do projeto
-- (ex.: uma função is_salon_member(salon_id) ou subquery em salon_members).
alter table public.ai_credits     enable row level security;
alter table public.ai_generations enable row level security;

create policy "ai_credits_member_read" on public.ai_credits
  for select using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

-- Consumo de crédito parte do app autenticado; restrinja o update a membros.
create policy "ai_credits_member_update" on public.ai_credits
  for update using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

create policy "ai_generations_member_read" on public.ai_generations
  for select using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

create policy "ai_generations_member_insert" on public.ai_generations
  for insert with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

-- ── Provisionamento ─────────────────────────────────────────────────────────
-- Cria a linha de créditos para todo salão Max. Rode também no momento em que
-- um salão assina/renova o Max (ou via trigger na sua tabela de assinaturas).
-- insert into public.ai_credits (salon_id, monthly_quota)
-- select id, 20 from public.salons s
-- where /* s é Max */ true
-- on conflict (salon_id) do nothing;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Crie um bucket privado 'marketing' e políticas de leitura/escrita por salão
-- quando ligar a geração ao vivo (as artes geradas ficam salvas para reuso).
