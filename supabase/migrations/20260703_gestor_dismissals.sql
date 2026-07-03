-- ─────────────────────────────────────────────────────────────────────────
-- "Dispensar até amanhã" dos avisos do Gestor Zulan.
--
-- O dono pode esconder uma categoria de aviso (pacotes vencendo, reativação,
-- etc.) por hoje. Guardamos a data (BR) da dispensa; na virada do dia o aviso
-- reaparece sozinho se a situação persistir. Uma linha por (salão, categoria):
-- ao dispensar de novo, só atualiza a data.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.gestor_dismissals (
  salon_id      uuid not null references public.salons(id) on delete cascade,
  signal_key    text not null,
  dismissed_on  date not null,
  updated_at    timestamptz not null default now(),
  primary key (salon_id, signal_key)
);

alter table public.gestor_dismissals enable row level security;

create policy "gestor_dismissals_member_read" on public.gestor_dismissals
  for select using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

create policy "gestor_dismissals_member_insert" on public.gestor_dismissals
  for insert with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );

create policy "gestor_dismissals_member_update" on public.gestor_dismissals
  for update
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  )
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );
