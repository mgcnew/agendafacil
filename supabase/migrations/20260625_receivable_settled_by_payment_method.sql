-- ─────────────────────────────────────────────────────────────────────────
-- "A receber" do caixa: regras de status + caso de valor R$ 0,00.
--
-- Problemas corrigidos:
-- 1) Atendimento de valor R$ 0,00 não saía de "Receber": finalize_appointment
--    só registra a cash_transaction quando o líquido é > 0, então o serviço
--    zerado ficava 'completed' (com payment_method) porém sem transação, e a
--    função continuava listando-o.
-- 2) A lista mostrava status demais (Confirmado, etc.). Passa a listar apenas
--    Aguardando (pending) e Em andamento (in_progress).
--
-- Detalhes do modelo:
-- • payment_method em appointments é o flag de "quitado no caixa":
--   finalize_appointment o define; reverse_cash_transaction o zera para o
--   atendimento reaparecer em "Receber". Por isso exigimos payment_method IS NULL.
-- • O estorno mantém status='completed' de propósito (não rebaixar estoque ao
--   recobrar). Por isso 'completed' entra na lista de status permitidos: um
--   atendimento estornado é completed + payment_method NULL e deve reaparecer.
--   Já um atendimento pago de fato é completed + payment_method NOT NULL → fora.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.receivable_today(p_salon uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_start timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_end timestamptz := v_start + interval '1 day';
  v jsonb;
begin
  if not (has_permission(p_salon, 'cash.view')
          or (select owner_id from salons where id = p_salon) = auth.uid()) then
    raise exception 'forbidden';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'client', coalesce(c.full_name, 'Cliente'),
           'member_id', a.member_id,
           'total', a.total_price,
           'time', to_char(a.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI'),
           'services', coalesce((select jsonb_agg(s.name order by s.name) from appointment_services s where s.appointment_id = a.id), '[]'::jsonb)
         ) order by a.starts_at), '[]'::jsonb)
  into v
  from appointments a
  left join clients c on c.id = a.client_id
  where a.salon_id = p_salon
    -- Aguardando / Em andamento; 'completed' só entra para cobrir estornos
    -- (completed + payment_method NULL), filtrados logo abaixo.
    and a.status in ('pending', 'in_progress', 'completed')
    and a.starts_at >= v_start and a.starts_at < v_end
    and a.payment_method is null
    and not exists (
      select 1 from cash_transactions t
      where t.appointment_id = a.id and t.type = 'income'
    );

  return v;
end;
$function$;
