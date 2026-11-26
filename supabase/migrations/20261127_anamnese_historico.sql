-- ─────────────────────────────────────────────────────────────────────────
-- Anamnese com histórico
--
-- A ficha era uma linha por cliente: cada "Salvar" apagava o que havia antes,
-- alergia era texto livre (o alerta só dizia "Alergias") e nada registrava o
-- produto usado em cada atendimento. Quem lida com cliente alérgica a um
-- esmalte específico precisa saber QUAL, desde quando e o que foi usado da
-- última vez.
--
--   client_allergies          uma alergia por linha: substância, categoria,
--                             reação, gravidade, quando percebeu. Remover só
--                             arquiva (archived_at) — o passado continua lá.
--   client_service_notes      ficha técnica por atendimento: produtos usados,
--                             reação e observação, ligada ao agendamento.
--   client_anamnesis_changes  quem mudou a ficha, quando e o quê (escrito só
--                             por trigger, ninguém edita).
--
-- O alerta (clients.alert_summary) passa a ser calculado aqui, a partir das
-- condições críticas e das alergias ativas. Os dois caminhos que já gravavam
-- o alerta (painel e link público) continuam funcionando: o valor que eles
-- mandam é ignorado e recalculado no BEFORE UPDATE de clients.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Alergias ─────────────────────────────────────────────────────────────
create table public.client_allergies (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  substance text not null check (btrim(substance) <> ''),
  category text not null default 'outro'
    check (category in ('esmalte', 'tintura', 'quimica', 'cola', 'latex', 'metal', 'cosmetico', 'medicamento', 'outro')),
  reaction text,
  severity text not null default 'moderada' check (severity in ('leve', 'moderada', 'grave')),
  noticed_on date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid
);

create index client_allergies_client_idx on public.client_allergies (client_id) where archived_at is null;

alter table public.client_allergies enable row level security;

create policy "allergies_select" on public.client_allergies
  for select using (has_permission(salon_id, 'clients.view'));
-- Profissional também registra: é ela quem vê a reação na cadeira.
create policy "allergies_insert" on public.client_allergies
  for insert with check (is_salon_member(salon_id));
create policy "allergies_update" on public.client_allergies
  for update using (is_salon_member(salon_id)) with check (is_salon_member(salon_id));

-- ── Ficha técnica por atendimento ────────────────────────────────────────
create table public.client_service_notes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  member_id uuid references public.salon_members(id) on delete set null,
  service_label text,
  products text,
  had_reaction boolean not null default false,
  reaction text,
  notes text,
  performed_on date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (coalesce(btrim(products), '') <> '' or coalesce(btrim(notes), '') <> '' or had_reaction)
);

create index client_service_notes_client_idx on public.client_service_notes (client_id, performed_on desc);

alter table public.client_service_notes enable row level security;

create policy "service_notes_select" on public.client_service_notes
  for select using (has_permission(salon_id, 'clients.view'));
create policy "service_notes_insert" on public.client_service_notes
  for insert with check (is_salon_member(salon_id) and created_by = auth.uid());
create policy "service_notes_update" on public.client_service_notes
  for update using (created_by = auth.uid() or has_permission(salon_id, 'clients.manage'));
create policy "service_notes_delete" on public.client_service_notes
  for delete using (created_by = auth.uid() or has_permission(salon_id, 'clients.manage'));

-- ── Histórico de alterações ──────────────────────────────────────────────
create table public.client_anamnesis_changes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  changed_by uuid,
  -- 'equipe' = alguém do salão; 'cliente' = pelo link público.
  source text not null default 'equipe' check (source in ('equipe', 'cliente')),
  changes text[] not null,
  created_at timestamptz not null default now()
);

create index client_anamnesis_changes_client_idx on public.client_anamnesis_changes (client_id, created_at desc);

alter table public.client_anamnesis_changes enable row level security;

create policy "anamnesis_changes_select" on public.client_anamnesis_changes
  for select using (has_permission(salon_id, 'clients.view'));

create or replace function public.log_anamnesis_change(p_salon uuid, p_client uuid, p_changes text[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(array_length(p_changes, 1), 0) = 0 then return; end if;
  insert into client_anamnesis_changes (salon_id, client_id, changed_by, source, changes)
  values (p_salon, p_client, auth.uid(),
          case when is_salon_member(p_salon) then 'equipe' else 'cliente' end,
          p_changes);
end; $$;

revoke execute on function public.log_anamnesis_change(uuid, uuid, text[]) from public, anon, authenticated;

-- ── Alerta calculado ─────────────────────────────────────────────────────
create or replace function public.client_alert_summary(p_client uuid)
returns text
language sql stable security definer set search_path = public
as $$
  with a as (select * from client_anamnesis where client_id = p_client),
  partes as (
    -- alergias graves primeiro: é o que não pode passar batido
    select 0 as ord, case when severity = 'grave' then 'Alergia grave: ' else 'Alergia: ' end || btrim(substance) as txt,
           case severity when 'grave' then 0 when 'moderada' then 1 else 2 end as sub
      from client_allergies where client_id = p_client and archived_at is null
    union all
    select 1, 'Alergias (ver ficha)', 0 from a where nullif(btrim(coalesce(a.allergies, '')), '') is not null
    union all select 2, 'Gestante', 0 from a where a.is_pregnant
    union all select 2, 'Lactante', 1 from a where a.is_breastfeeding
    union all select 2, 'Diabetes', 2 from a where a.has_diabetes
    union all select 2, 'Hipertensão', 3 from a where a.has_hypertension
    union all select 2, 'Problema cardíaco / marcapasso', 4 from a where a.has_heart_condition
    union all select 2, 'Coagulação / anticoagulante', 5 from a where a.has_coagulation_issue
    union all select 2, 'Epilepsia', 6 from a where a.has_epilepsy
    union all select 2, 'Tratamento oncológico', 7 from a where a.has_cancer_treatment
  )
  select nullif(string_agg(txt, ' · ' order by ord, sub, txt), '') from partes;
$$;

-- Quem grava alert_summary (painel antigo, link público) tem o valor
-- substituído pelo calculado — assim não existem duas regras.
create or replace function public.clients_alert_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.alert_summary := client_alert_summary(new.id);
  return new;
end; $$;

create trigger clients_alert_guard
  before update of alert_summary on public.clients
  for each row execute function public.clients_alert_guard();

-- ── Triggers da ficha ────────────────────────────────────────────────────
create or replace function public.anamnesis_after_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_changes text[] := '{}';
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := to_jsonb(new);
  f record;
  ov text; nv text;
begin
  for f in select * from (values
    ('is_pregnant', 'Gestante'), ('is_breastfeeding', 'Lactante'), ('has_diabetes', 'Diabetes'),
    ('has_hypertension', 'Hipertensão'), ('has_heart_condition', 'Problema cardíaco / marcapasso'),
    ('has_coagulation_issue', 'Coagulação / anticoagulante'), ('has_epilepsy', 'Epilepsia'),
    ('has_cancer_treatment', 'Tratamento oncológico'), ('has_thyroid', 'Tireoide')
  ) as t(col, label) loop
    if coalesce((o ->> f.col)::boolean, false) is distinct from coalesce((n ->> f.col)::boolean, false) then
      v_changes := v_changes || (case when (n ->> f.col)::boolean then 'Marcou ' else 'Desmarcou ' end || f.label);
    end if;
  end loop;

  for f in select * from (values
    ('allergies', 'anotação de alergias'), ('medications', 'medicamentos em uso'),
    ('recent_procedures', 'procedimentos recentes'), ('skin_hair_notes', 'pele / cabelo / unhas'),
    ('general_notes', 'outras observações')
  ) as t(col, label) loop
    ov := nullif(btrim(coalesce(o ->> f.col, '')), '');
    nv := nullif(btrim(coalesce(n ->> f.col, '')), '');
    if ov is distinct from nv then
      v_changes := v_changes || (case
        when ov is null then 'Preencheu ' || f.label || ': ' || left(nv, 120)
        when nv is null then 'Apagou ' || f.label
        else 'Alterou ' || f.label || ': ' || left(nv, 120) end);
    end if;
  end loop;

  if coalesce((o ->> 'consent_given')::boolean, false) is distinct from new.consent_given then
    v_changes := v_changes || (case when new.consent_given
      then 'Registrou o termo de consentimento' || coalesce(' (' || nullif(btrim(new.consent_name), '') || ')', '')
      else 'Retirou o termo de consentimento' end);
  end if;

  perform log_anamnesis_change(new.salon_id, new.client_id, v_changes);
  update clients set alert_summary = null where id = new.client_id;
  return new;
end; $$;

create trigger anamnesis_after_write
  after insert or update on public.client_anamnesis
  for each row execute function public.anamnesis_after_write();

create or replace function public.allergies_after_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_desc text := btrim(new.substance) || ' (' || new.severity || ')';
begin
  if tg_op = 'INSERT' then
    perform log_anamnesis_change(new.salon_id, new.client_id,
      array['Adicionou alergia: ' || v_desc || coalesce(' — ' || nullif(btrim(new.reaction), ''), '')]);
  elsif old.archived_at is null and new.archived_at is not null then
    perform log_anamnesis_change(new.salon_id, new.client_id, array['Removeu alergia: ' || v_desc]);
  elsif row(old.substance, old.category, old.reaction, old.severity, old.noticed_on)
        is distinct from row(new.substance, new.category, new.reaction, new.severity, new.noticed_on) then
    perform log_anamnesis_change(new.salon_id, new.client_id, array['Editou alergia: ' || v_desc]);
  end if;
  update clients set alert_summary = null where id = new.client_id;
  return new;
end; $$;

create trigger allergies_after_write
  after insert or update on public.client_allergies
  for each row execute function public.allergies_after_write();

-- Recalcula o alerta de quem já tem ficha (o antigo dizia só "Alergias").
update public.clients c set alert_summary = null
 where exists (select 1 from public.client_anamnesis a where a.client_id = c.id)
    or c.alert_summary is not null;
