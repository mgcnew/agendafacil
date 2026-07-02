-- ─────────────────────────────────────────────────────────────────────────
-- Blog: posts editáveis pelo admin da plataforma, sem depender de deploy.
-- Corpo em Markdown-lite (## subtítulo, linha em branco = parágrafo, "- " =
-- bullet), convertido para seções na hora de renderizar (src/lib/blog).
-- Leitura pública liberada só para publicados; escrita só via RPCs
-- SECURITY DEFINER que checam is_platform_admin() (mesmo padrão de avisos).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists blog_posts (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null unique,
  title         text        not null,
  excerpt       text        not null,
  category      text        not null,
  body          text        not null,
  read_minutes  int         not null default 5,
  published_at  date        not null default current_date,
  is_published  boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid        references profiles(id)
);
alter table blog_posts enable row level security;

drop policy if exists "public reads published posts" on blog_posts;
create policy "public reads published posts" on blog_posts
  for select to anon, authenticated using (is_published = true);

create or replace function admin_list_blog_posts()
returns setof blog_posts
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query select * from blog_posts order by published_at desc, created_at desc;
end;
$$;

create or replace function admin_create_blog_post(
  p_slug text, p_title text, p_excerpt text, p_category text, p_body text,
  p_read_minutes int, p_published_at date, p_is_published boolean
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_slug), '') = '' then raise exception 'slug vazio'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'título vazio'; end if;
  insert into blog_posts (slug, title, excerpt, category, body, read_minutes, published_at, is_published, created_by)
  values (
    trim(p_slug), trim(p_title), trim(p_excerpt), trim(p_category), p_body,
    greatest(1, coalesce(p_read_minutes, 1)),
    coalesce(p_published_at, current_date),
    coalesce(p_is_published, true),
    auth.uid()
  )
  returning id into v_id;
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'create_blog_post', jsonb_build_object('slug', p_slug, 'title', left(p_title, 80)));
  return v_id;
end;
$$;

create or replace function admin_update_blog_post(
  p_id uuid, p_slug text, p_title text, p_excerpt text, p_category text, p_body text,
  p_read_minutes int, p_published_at date, p_is_published boolean
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_slug), '') = '' then raise exception 'slug vazio'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'título vazio'; end if;
  update blog_posts set
    slug = trim(p_slug),
    title = trim(p_title),
    excerpt = trim(p_excerpt),
    category = trim(p_category),
    body = p_body,
    read_minutes = greatest(1, coalesce(p_read_minutes, 1)),
    published_at = coalesce(p_published_at, published_at),
    is_published = coalesce(p_is_published, is_published),
    updated_at = now()
  where id = p_id;
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'update_blog_post', jsonb_build_object('slug', p_slug, 'title', left(p_title, 80)));
end;
$$;

create or replace function admin_delete_blog_post(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  delete from blog_posts where id = p_id;
  insert into admin_audit_log (actor, action, detail)
    values (auth.uid(), 'delete_blog_post', jsonb_build_object('id', p_id));
end;
$$;

-- Seed: migra os 3 posts que hoje vivem hardcoded em src/lib/blog/posts.ts.
insert into blog_posts (slug, title, excerpt, category, body, read_minutes, published_at, is_published)
values
(
  'como-reduzir-faltas-no-salao',
  'Como reduzir faltas (no-show) no salão ou barbearia',
  'Cadeira vazia é dinheiro perdido. Veja práticas simples para diminuir faltas e recuperar quem não apareceu.',
  'Gestão',
$md$A falta de cliente (o famoso no-show) é um dos maiores ralos de faturamento de salões e barbearias. Cada horário reservado e não cumprido é um espaço que poderia ter sido de outra pessoa — e que não volta. A boa notícia é que dá para reduzir muito as faltas com pequenas mudanças no processo.

## 1. Confirme o horário com antecedência
A maioria das faltas não é má-fé: é esquecimento. Um lembrete um dia antes e algumas horas antes do atendimento já corta boa parte dos no-shows. Quando o agendamento é online, a própria cliente recebe a confirmação na hora em que marca, o que reduz a chance de confusão de data e horário.

## 2. Facilite o reagendamento
Muita gente falta porque não conseguiu avisar a tempo ou achou trabalhoso remarcar. Quando a cliente consegue cancelar e reagendar sozinha pelo link, o horário é liberado automaticamente para outra pessoa — você não perde o espaço e ainda mantém o relacionamento.

## 3. Tenha uma política clara
Deixe combinado o que acontece em caso de falta sem aviso. Não precisa ser rígido: uma comunicação gentil já educa a clientela. Para quem falta com frequência, considere pedir confirmação obrigatória ou um sinal no próximo agendamento.

## 4. Recupere quem faltou
Faltou não significa cliente perdido. Uma mensagem no dia seguinte — leve, sem cobrança — convidando a remarcar costuma trazer a pessoa de volta. Vale ainda anexar um cupom de retorno para dar aquele empurrãozinho.

- Liste quem faltou ou cancelou nos últimos dias.
- Mande uma mensagem pronta no WhatsApp convidando a remarcar.
- Ofereça um desconto de retorno quando fizer sentido.

## Como o Zulan ajuda
No Zulan, a cliente agenda pelo seu link, recebe confirmação automática e pode cancelar sozinha (liberando o horário na hora). E a aba Recuperar clientes reúne quem faltou, cancelou ou está sumido, com um botão para chamar no WhatsApp com a mensagem pronta — e cupom de retorno opcional.$md$,
  5, '2026-06-24', true
),
(
  'link-de-agendamento-online-para-saloes',
  'Link de agendamento online: por que seu salão precisa de um',
  'Sair do vai-e-volta no WhatsApp muda o jogo. Entenda como um link de agendamento profissionaliza o salão e libera o seu tempo.',
  'Agendamento',
$md$Atender agendamento por mensagem parece prático, mas cobra um preço alto: interrompe o atendimento, gera confusão de horários e some no meio das conversas. Um link de agendamento online resolve isso colocando a sua agenda para trabalhar sozinha.

## A cliente marca quando quiser
Com um link, a pessoa vê os horários disponíveis e escolhe o que cabe na rotina dela — inclusive de madrugada ou no fim de semana, quando você não está respondendo mensagem. Você acorda com a agenda preenchida.

## Menos erro, menos retrabalho
Como o horário é confirmado na hora, acaba o risco de marcar duas clientes no mesmo encaixe ou anotar errado no caderninho. Tudo fica registrado, organizado e acessível pelo celular.

## Imagem mais profissional
Um link bonito, com a sua marca, passa seriedade. É o tipo de detalhe que faz a cliente confiar mais e indicar o seu trabalho. E você ainda pode divulgar esse link no Instagram, no status do WhatsApp e no Google.

## Comece simples
Não precisa de site nem de conhecimento técnico. No Zulan, você cria o salão em poucos minutos, cadastra serviços e horários e já recebe um link pronto para compartilhar. A cliente agenda, recebe confirmação automática e você só aparece para atender.$md$,
  4, '2026-06-20', true
),
(
  'ideias-para-lotar-a-agenda-do-salao',
  '7 ideias para lotar a agenda do seu salão',
  'Da divulgação ao pós-atendimento: ideias práticas para encher a agenda sem depender só do boca a boca.',
  'Marketing',
$md$Agenda cheia não é sorte — é processo. Pequenas ações repetidas com constância enchem mais a agenda do que uma promoção isolada. Veja sete ideias que funcionam para salões e barbearias de qualquer tamanho.

## 1. Espalhe seu link de agendamento
Coloque o link na bio do Instagram, no status do WhatsApp e na ficha do Google. Quanto mais fácil for marcar, mais gente marca.

## 2. Reative clientes antigos
Quem já te conhece é o público mais barato de trazer de volta. Uma mensagem para quem não aparece há um tempo costuma reabrir muitos horários.

## 3. Crie campanhas com prazo
Descontos sem data viram preço novo. Campanhas com começo e fim criam urgência e movimentam dias mais fracos da semana.

## 4. Aproveite os horários ociosos
Ofereça uma condição especial para os períodos vagos (manhãs, meio de semana). Melhor a cadeira ocupada com margem menor do que parada.

## 5. Incentive a indicação
Cliente satisfeita traz cliente. Um benefício simples para quem indica amiga rende novos agendamentos com custo quase zero.

## 6. Capriche no pós-atendimento
Já saia com o próximo horário marcado e mantenha contato. A recompra é o que sustenta a agenda cheia ao longo do mês.

## 7. Mostre seu trabalho
Fotos de antes e depois, depoimentos e artes de divulgação atraem quem ainda não te conhece. Conteúdo constante mantém você na lembrança.

## Junte tudo num lugar só
O Zulan reúne o link de agendamento, campanhas, recuperação de clientes e criação de artes de divulgação — para você executar essas ideias sem pular de ferramenta em ferramenta.$md$,
  6, '2026-06-16', true
)
on conflict (slug) do nothing;
