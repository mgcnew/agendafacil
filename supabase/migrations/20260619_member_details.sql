-- ─────────────────────────────────────────────────────────────────────────
-- Dados cadastrais/trabalhistas do profissional (RH leve)
--
-- Informações pessoais e de vínculo de cada membro da equipe: documentos,
-- endereço e tipo de acordo (CLT, autônomo, aluguel de cadeira, freelancer).
-- Tabela SEPARADA de salon_members para não inflar a tabela principal e por
-- conter dados sensíveis (CPF/RG/endereço) — acesso restrito a dono/gerente.
--
-- "Aluguel de cadeira": o profissional não recebe comissão do salão, ele PAGA
-- um valor (mensal) pelo espaço. Por isso chair_rent_amount + chair_rent_due_day.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.salon_member_details (
  member_id          uuid primary key references public.salon_members(id) on delete cascade,
  salon_id           uuid not null references public.salons(id) on delete cascade,

  -- Vínculo de trabalho
  employment_type    text,            -- 'clt' | 'autonomo' | 'chair_rent' | 'freelancer' | 'other'
  chair_rent_amount  numeric(10,2),   -- valor do aluguel de cadeira (quando employment_type = 'chair_rent')
  chair_rent_due_day integer,         -- dia do vencimento (1..28)

  -- Documentos
  cpf                text,
  rg                 text,
  birth_date         date,
  personal_phone     text,

  -- Endereço
  zip                text,
  street             text,
  number             text,
  complement         text,
  neighborhood       text,
  city               text,
  state              text,            -- UF

  -- Contrato
  contract_signed    boolean not null default false,
  contract_signed_at date,

  notes              text,

  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles(id)
);

create index if not exists salon_member_details_salon_idx
  on public.salon_member_details (salon_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Dados sensíveis: somente dono/gerente do salão podem ver e editar.
alter table public.salon_member_details enable row level security;

create policy "member_details_manager_select" on public.salon_member_details
  for select using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role in ('owner', 'manager')
    )
  );

create policy "member_details_manager_insert" on public.salon_member_details
  for insert with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role in ('owner', 'manager')
    )
  );

create policy "member_details_manager_update" on public.salon_member_details
  for update using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role in ('owner', 'manager')
    )
  );

create policy "member_details_manager_delete" on public.salon_member_details
  for delete using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role in ('owner', 'manager')
    )
  );
