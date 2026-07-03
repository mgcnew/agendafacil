-- ─────────────────────────────────────────────────────────────────────────
-- Notificações push (FCM). Cada linha é um dispositivo/navegador que um
-- membro ativou notificação para um salão específico (opt-in por
-- dispositivo, não por conta — a mesma pessoa em dois aparelhos tem duas
-- linhas). Quem recebe notificação de um evento do salão = todo mundo com
-- uma linha aqui pra esse salon_id (sem filtro por cargo nesta v1).
-- ─────────────────────────────────────────────────────────────────────────

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, token)
);

create index push_subscriptions_salon_idx on public.push_subscriptions(salon_id);

alter table public.push_subscriptions enable row level security;

-- Cada membro só vê/gerencia as próprias inscrições, e só pra salões dos
-- quais é membro (mesma checagem usada em finalize_appointment etc.).
create policy "members manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (profile_id = auth.uid() and is_salon_member(salon_id))
  with check (profile_id = auth.uid() and is_salon_member(salon_id));
