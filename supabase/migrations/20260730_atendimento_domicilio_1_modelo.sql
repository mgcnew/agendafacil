-- ─────────────────────────────────────────────────────────────────────────
-- Atendimento em domicílio — modelo.
--
-- O objetivo é um só: cliente que não pode ir ao salão não perder a
-- profissional dela. Quem tem "profissional favorita" já é cliente da casa —
-- e isso define todo o desenho.
--
-- A DECISÃO CENTRAL: a distância é característica do CLIENTE, não do
-- agendamento. O endereço dela não muda entre uma unha e outra. Por isso
-- `clients.distance_km` é medido UMA VEZ, pela profissional, e reaproveitado
-- para sempre. É o que dispensa API de rota paga: não recalculamos a mesma
-- distância todo mês.
--
-- Por que não calcular sozinho a partir do CEP: testado e reprovado. A API de
-- CEP devolve coordenada de RUA, não de endereço — dois CEPs da Av. Paulista
-- voltam o mesmo ponto, e a avenida tem 3 km. Pior: cidade pequena tem "CEP
-- geral", um único ponto para o município inteiro (testei Sorriso/MT, Jaru/RO
-- e Açailândia/MA — todas devolveram uma coordenada só). E cidade pequena é
-- justamente onde domicílio é mais comum.
--
-- A estimativa por CEP continua existindo, mas só como SUGESTÃO para a
-- profissional conferir — nunca virando preço direto. Palpite revisado por
-- humano é uma coisa; palpite virando cobrança silenciosa é outra.
--
-- Sobre o dinheiro: a taxa entra em `appointments.total_price`, porque o salão
-- recebe esse valor de verdade e o caixa precisa cobrar certo. Fica TAMBÉM em
-- coluna própria pra dar pra separar em relatório. E fica fora da comissão
-- sem nenhuma gambiarra: `commissions` é por `appointment_service_id`, e taxa
-- de deslocamento não é serviço — logo não gera linha, logo não gera comissão.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Configuração do salão ────────────────────────────────────────────────
alter table public.salons
  add column if not exists home_service_enabled boolean not null default false,
  add column if not exists home_first_km_fee numeric(10,2) not null default 0,
  add column if not exists home_extra_km_fee numeric(10,2) not null default 0,
  -- null = sem limite declarado. Não bloqueia agendamento (no primeiro pedido
  -- ainda não se sabe o km); serve pra avisar a cliente na página e alertar a
  -- profissional na hora de confirmar.
  add column if not exists home_max_km numeric(6,1),
  add column if not exists home_terms text;

alter table public.salons drop constraint if exists salons_home_fees_check;
alter table public.salons add constraint salons_home_fees_check
  check (home_first_km_fee >= 0 and home_extra_km_fee >= 0
         and (home_max_km is null or home_max_km > 0));

-- ── Quais serviços aceitam domicílio ─────────────────────────────────────
-- Por serviço, não por salão: a manicure faz esmaltação em casa e não faz
-- alongamento em fibra (precisa de cabine). Chave geral traria pedido do
-- serviço errado. Mesmo desenho de `bring_own_tools`.
alter table public.services
  add column if not exists allows_home_service boolean not null default false;

-- ── Endereço e distância do cliente ──────────────────────────────────────
-- Medido uma vez, vale sempre. `distance_km` é o número que a profissional
-- leu no Maps — não uma estimativa nossa.
alter table public.clients
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists distance_km numeric(6,1);

alter table public.clients drop constraint if exists clients_distance_km_check;
alter table public.clients add constraint clients_distance_km_check
  check (distance_km is null or (distance_km >= 0 and distance_km <= 500));

-- ── Modalidade e taxa no agendamento ─────────────────────────────────────
alter table public.appointments
  add column if not exists service_mode text not null default 'salon',
  add column if not exists travel_km numeric(6,1),
  add column if not exists travel_fee numeric(10,2) not null default 0,
  -- Cópia do endereço no momento do agendamento. A cliente pode mudar de casa;
  -- o histórico precisa dizer onde a profissional foi DAQUELA vez.
  add column if not exists home_address text;

alter table public.appointments drop constraint if exists appointments_service_mode_check;
alter table public.appointments add constraint appointments_service_mode_check
  check (service_mode in ('salon', 'home'));

alter table public.appointments drop constraint if exists appointments_travel_check;
alter table public.appointments add constraint appointments_travel_check
  check (travel_fee >= 0 and (travel_km is null or travel_km >= 0));

-- Fila da profissional: pedidos de domicílio ainda sem quilometragem definida.
create index if not exists appointments_home_pending_idx
  on public.appointments (salon_id, starts_at)
  where service_mode = 'home' and travel_km is null;

-- ── Cálculo da taxa ──────────────────────────────────────────────────────
/**
 * Tarifa: primeiro km + adicional por km, arredondando o km PRA CIMA.
 *
 * Arredondar pra cima é como toda tarifa de deslocamento é comunicada no
 * Brasil, e é o que a pessoa consegue conferir de cabeça. A tela mostra o
 * valor enquanto a profissional digita o km, então nunca vira surpresa.
 *
 * Fonte única do cálculo: a página pública, o painel e o comprovante chamam
 * esta função. Duplicar a conta em TypeScript abriria espaço pra tela e
 * cobrança discordarem.
 */
create or replace function public.home_service_fee(p_salon uuid, p_km numeric)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select case
    when p_km is null or p_km <= 0 then 0::numeric
    else round(
      s.home_first_km_fee + greatest(ceil(p_km) - 1, 0) * s.home_extra_km_fee,
      2)
  end
  from salons s where s.id = p_salon;
$function$;

grant execute on function public.home_service_fee(uuid, numeric) to authenticated, anon;
