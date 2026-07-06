-- ─────────────────────────────────────────────────────────────────────────
-- Convite opcional pra ficha de anamnese na página pública de agendamento
-- (BookingApp.tsx), logo após o cliente confirmar o agendamento.
--
-- 1. public_needs_anamnesis: diz se aquele cliente AINDA não tem ficha
--    preenchida (nem pela equipe, nem por ele mesmo) — usado pra só convidar
--    "na primeira vez", como pedido.
-- 2. public_save_anamnesis: grava a ficha (upsert 1:1 por client_id) e
--    atualiza clients.alert_summary, mesma lógica do painel interno
--    (computeAlertSummary em src/lib/anamnesis.ts), só que o resumo já vem
--    calculado do cliente pra não duplicar a regra em SQL.
--    Exige p_consent_given = true (diferente do painel, onde a equipe pode
--    salvar sem aceite — aqui é o próprio cliente preenchendo sem supervisão).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.public_needs_anamnesis(
  p_client_id uuid,
  p_phone text default null
)
 returns boolean
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_phone text;
  v_profile uuid;
begin
  select phone, profile_id into v_phone, v_profile
  from clients where id = p_client_id;
  if not found then raise exception 'not_found'; end if;

  if not (
       (v_profile is not null and v_profile = auth.uid())
    or (p_phone is not null and v_phone is not null and v_phone = p_phone)
  ) then
    raise exception 'forbidden';
  end if;

  return not exists (select 1 from client_anamnesis where client_id = p_client_id);
end;
$function$;

grant execute on function public.public_needs_anamnesis(uuid, text) to anon, authenticated;

create or replace function public.public_save_anamnesis(
  p_client_id uuid,
  p_consent_given boolean,
  p_phone text default null,
  p_is_pregnant boolean default false,
  p_is_breastfeeding boolean default false,
  p_has_diabetes boolean default false,
  p_has_hypertension boolean default false,
  p_has_heart_condition boolean default false,
  p_has_coagulation_issue boolean default false,
  p_has_epilepsy boolean default false,
  p_has_cancer_treatment boolean default false,
  p_has_thyroid boolean default false,
  p_allergies text default null,
  p_medications text default null,
  p_recent_procedures text default null,
  p_skin_hair_notes text default null,
  p_general_notes text default null,
  p_consent_name text default null,
  p_alert_summary text default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_salon uuid;
  v_phone text;
  v_profile uuid;
begin
  if not p_consent_given then
    raise exception 'consent_required';
  end if;

  select salon_id, phone, profile_id into v_salon, v_phone, v_profile
  from clients where id = p_client_id;
  if v_salon is null then raise exception 'not_found'; end if;

  if not (
       (v_profile is not null and v_profile = auth.uid())
    or (p_phone is not null and v_phone is not null and v_phone = p_phone)
  ) then
    raise exception 'forbidden';
  end if;

  insert into client_anamnesis (
    client_id, salon_id, is_pregnant, is_breastfeeding, has_diabetes, has_hypertension,
    has_heart_condition, has_coagulation_issue, has_epilepsy, has_cancer_treatment, has_thyroid,
    allergies, medications, recent_procedures, skin_hair_notes, general_notes,
    consent_given, consent_name, consent_at, updated_at
  ) values (
    p_client_id, v_salon, p_is_pregnant, p_is_breastfeeding, p_has_diabetes, p_has_hypertension,
    p_has_heart_condition, p_has_coagulation_issue, p_has_epilepsy, p_has_cancer_treatment, p_has_thyroid,
    p_allergies, p_medications, p_recent_procedures, p_skin_hair_notes, p_general_notes,
    true, p_consent_name, now(), now()
  )
  on conflict (client_id) do update set
    is_pregnant = excluded.is_pregnant,
    is_breastfeeding = excluded.is_breastfeeding,
    has_diabetes = excluded.has_diabetes,
    has_hypertension = excluded.has_hypertension,
    has_heart_condition = excluded.has_heart_condition,
    has_coagulation_issue = excluded.has_coagulation_issue,
    has_epilepsy = excluded.has_epilepsy,
    has_cancer_treatment = excluded.has_cancer_treatment,
    has_thyroid = excluded.has_thyroid,
    allergies = excluded.allergies,
    medications = excluded.medications,
    recent_procedures = excluded.recent_procedures,
    skin_hair_notes = excluded.skin_hair_notes,
    general_notes = excluded.general_notes,
    consent_given = excluded.consent_given,
    consent_name = excluded.consent_name,
    consent_at = excluded.consent_at,
    updated_at = now();

  update clients set alert_summary = p_alert_summary where id = p_client_id;
end;
$function$;

grant execute on function public.public_save_anamnesis(
  uuid, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, text, text, text, text, text, text, text
) to anon, authenticated;
