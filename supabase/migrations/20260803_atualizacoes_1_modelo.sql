-- ─────────────────────────────────────────────────────────────────────────
-- O que mudou, o que vem, e o que ela pediu.
--
-- A dona paga uma mensalidade para software de uma empresa que ela nunca
-- ouviu falar. A pergunta silenciosa dela não é "tem tal recurso?", é "isso
-- aqui vai existir daqui a seis meses?". Hoje o sistema entrega toda semana e
-- nada disso chega até ela — o trabalho existe, a prova de vida não.
--
-- NÃO É O platform_announcements. Aquele é recado de uma linha que liga e
-- desliga ("domingo teremos manutenção"); some quando deixa de valer. Isto é
-- arquivo: entregue uma vez, verdade para sempre. Ciclos de vida opostos numa
-- tabela só viram um campo `is_active` que ninguém sabe quando mexer.
--
-- POR QUE O "EM CONSTRUÇÃO" É UM STATUS E NÃO UMA TABELA DE ROADMAP: esteira
-- pública com data é fábrica de decepção — dev solo escorrega, e o que era
-- entusiasmo vira dívida. Aqui só existem duas coisas: o que está sendo feito
-- AGORA (sem data) e o que já foi entregue (com data). Nada de "previsto para
-- setembro".
--
-- A SUGESTÃO SEM STATUS É PIOR QUE NÃO TER CAIXA DE SUGESTÃO. Ela escreve,
-- nada volta, e agora ela se sente ignorada — antes só não tinha por onde
-- falar. Por isso `status` é not null com padrão 'recebida', e 'nao_planejada'
-- exige resposta escrita: dizer não é obrigatório, sumir não é opção. É o
-- mesmo inimigo do orçamento de domicílio que ficava em limbo — silêncio.
-- ─────────────────────────────────────────────────────────────────────────

-- ── O que mudou / o que vem ──────────────────────────────────────────────
create table if not exists public.product_updates (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  body        text        not null,
  -- Três tipos porque a dona lê os três de forma diferente: novidade é o que
  -- ela pode fazer agora, melhoria é o que já fazia e ficou melhor, correção
  -- é a admissão de que algo estava errado — e admitir compra confiança.
  kind        text        not null default 'novidade'
              check (kind in ('novidade', 'melhoria', 'correcao')),
  status      text        not null default 'building'
              check (status in ('building', 'shipped')),
  -- Só existe quando entregou. Enquanto está em construção não há data, de
  -- propósito: data de promessa é o que a gente está evitando.
  shipped_at  timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid        references public.profiles(id)
);

alter table public.product_updates
  drop constraint if exists product_updates_shipped_tem_data;
alter table public.product_updates
  add constraint product_updates_shipped_tem_data
  check (status <> 'shipped' or shipped_at is not null);

create index if not exists product_updates_shipped_idx
  on public.product_updates (shipped_at desc) where status = 'shipped';

alter table public.product_updates enable row level security;

-- Qualquer pessoa logada lê. Não há nada de um salão aqui — é a mesma
-- história do produto para todo mundo.
drop policy if exists "logado le atualizacoes" on public.product_updates;
create policy "logado le atualizacoes" on public.product_updates
  for select to authenticated using (true);

-- ── O que ela pediu ──────────────────────────────────────────────────────
create table if not exists public.product_suggestions (
  id         uuid        primary key default gen_random_uuid(),
  salon_id   uuid        not null references public.salons(id) on delete cascade,
  author_id  uuid        references public.profiles(id) on delete set null,
  body       text        not null,
  status     text        not null default 'recebida'
             check (status in ('recebida', 'em_analise', 'planejada',
                               'em_construcao', 'entregue', 'nao_planejada')),
  -- A resposta de quem leu. Obrigatória para recusar.
  reply      text,
  -- O fecho: quando entrega, aponta para a linha do histórico. É o que
  -- transforma "mandei uma sugestão" em "aquilo que eu pedi está no ar".
  update_id  uuid        references public.product_updates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_suggestions
  drop constraint if exists product_suggestions_recusa_tem_motivo;
alter table public.product_suggestions
  add constraint product_suggestions_recusa_tem_motivo
  check (status <> 'nao_planejada' or nullif(btrim(coalesce(reply, '')), '') is not null);

create index if not exists product_suggestions_salon_idx
  on public.product_suggestions (salon_id, created_at desc);

alter table public.product_suggestions enable row level security;

-- Quem é do salão lê o que o salão mandou. Sugestão é privada: sem voto e sem
-- outros salões vendo. Voto é uma tabela a mais no dia em que houver plateia;
-- agora só criaria moderação e o receio de a concorrente ver a ideia.
drop policy if exists "membro le sugestoes do salao" on public.product_suggestions;
create policy "membro le sugestoes do salao" on public.product_suggestions
  for select to authenticated using (is_salon_member(salon_id));

drop policy if exists "membro escreve sugestao" on public.product_suggestions;
create policy "membro escreve sugestao" on public.product_suggestions
  for insert to authenticated
  with check (is_salon_member(salon_id) and author_id = auth.uid());

-- Sem policy de update/delete: mexer em status é do admin, pelas RPCs abaixo.
-- Deixar a autora editar depois de enviado só criaria a dúvida de qual versão
-- foi lida.

-- ── O pontinho de "não lido" ─────────────────────────────────────────────
-- Uma coluna no perfil em vez de tabela de leitura por item: o que interessa
-- é "tem coisa nova desde a última vez que ela olhou", e isso é uma data.
alter table public.profiles
  add column if not exists updates_seen_at timestamptz;
