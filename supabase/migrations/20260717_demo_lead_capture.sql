-- Captura de lead no demo: quem testa e pede os 14 dias vira lead na
-- Prospecção (channel 'demo'), em vez de sumir sem rastro.
--
-- LGPD: o aceite de ofertas é opcional e NÃO é condição pra usar o demo nem
-- pra ganhar o trial — consentimento forçado é consentimento inválido, que é
-- exatamente o problema que se quer evitar. Guardamos data + texto aceito
-- pra ter prova de quando e com o que a pessoa concordou.
alter table public.growth_leads
  add column if not exists email text,
  add column if not exists accepts_marketing boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_text text;

-- 'demo' como origem, ao lado de porta a porta / instagram / etc.
alter table public.growth_leads drop constraint if exists growth_leads_channel_check;
alter table public.growth_leads add constraint growth_leads_channel_check
  check (channel = any (array[
    'porta_a_porta','indicacao','instagram','whatsapp','google','parceria','demo','outro'
  ]));

-- Mesma pessoa voltando ao demo não pode virar lead duplicado.
create unique index if not exists growth_leads_demo_email_key
  on public.growth_leads (lower(email)) where channel = 'demo' and email is not null;

/**
 * Grava o lead do demo. SECURITY DEFINER porque growth_leads é do admin da
 * plataforma — mas só quem está dentro de um salão demo pode chamar, então
 * isso não vira um endpoint aberto de escrita.
 */
create or replace function public.capture_demo_lead(
  p_name text,
  p_email text,
  p_contact text,
  p_accepts_marketing boolean,
  p_consent_text text
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := lower(nullif(trim(p_email), ''));
  v_name text := nullif(trim(p_name), '');
  v_contact text := nullif(trim(p_contact), '');
  v_at timestamptz := case when p_accepts_marketing then now() else null end;
  v_txt text := case when p_accepts_marketing then p_consent_text else null end;
begin
  if not exists (
    select 1 from salon_members m
    join salons s on s.id = m.salon_id
    where m.profile_id = auth.uid() and s.is_demo
  ) then
    raise exception 'forbidden';
  end if;

  if v_name is null or v_email is null then
    raise exception 'dados_incompletos';
  end if;

  update growth_leads set
    name = v_name,
    contact = coalesce(v_contact, contact),
    accepts_marketing = p_accepts_marketing,
    consent_at = v_at,
    consent_text = v_txt,
    updated_at = now()
  where channel = 'demo' and lower(email) = v_email;

  if not found then
    insert into growth_leads
      (name, email, contact, channel, stage, accepts_marketing, consent_at, consent_text)
    values
      (v_name, v_email, v_contact, 'demo', 'demo', p_accepts_marketing, v_at, v_txt);
  end if;
end;
$function$;

revoke all on function public.capture_demo_lead(text, text, text, boolean, text) from public, anon;
grant execute on function public.capture_demo_lead(text, text, text, boolean, text) to authenticated;
