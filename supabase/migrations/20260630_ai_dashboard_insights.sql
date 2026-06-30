-- ─────────────────────────────────────────────────────────────────────────
-- Resumo diário do "Gestor Zulan" no Dashboard (IA — DeepSeek)
--
-- Cache de 1 geração por salão por dia: evita chamar a API a cada carregamento
-- da página. Gerado sob demanda na primeira visita do dia (ver
-- src/lib/ai/dashboardInsights.ts) e reaproveitado pelo resto do dia.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_dashboard_insights (
  salon_id    uuid not null references public.salons(id) on delete cascade,
  date        date not null,
  payload     jsonb not null,            -- { greeting, insights: [{ type, title, detail, priority }] }
  model       text,
  created_at  timestamptz not null default now(),
  primary key (salon_id, date)
);

alter table public.ai_dashboard_insights enable row level security;

create policy "ai_dashboard_insights_member_read" on public.ai_dashboard_insights
  for select using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

create policy "ai_dashboard_insights_member_insert" on public.ai_dashboard_insights
  for insert with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );
