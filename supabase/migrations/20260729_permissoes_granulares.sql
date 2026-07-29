-- ─────────────────────────────────────────────────────────────────────────
-- Permissões — rótulos honestos e cinco chaves novas.
--
-- O painel de Acessos foi feito antes de várias telas existirem. Quando elas
-- chegaram, foram penduradas na permissão mais próxima, e o dono acabava
-- concedendo muito mais do que queria pra liberar uma coisa só:
--
--   Assinatura  → salon.manage    (quem edita o nome do salão mexia no plano)
--   WhatsApp    → salon.manage    (conectar o número afeta TODOS os clientes)
--   Galeria     → salon.manage    (publicar foto exigia a permissão mais alta)
--   Divulgação  → services.manage (quem edita preço passava a gastar crédito)
--   Campanhas   → services.manage
--   Recuperar   → clients.view    (uma permissão de VER liberando DISPARAR
--                                  mensagem pra base inteira)
--
-- Herança: salon.manage e services.manage já eram, respectivamente, só-dono e
-- só-gerente. As chaves novas nascem com os mesmos padrões, então ninguém
-- perde acesso — muda só a granularidade. A exceção está comentada abaixo.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Rótulos que não se distinguiam ───────────────────────────────────────
-- "Ver comissões" e "Ver comissões de todos" eram indistinguíveis pra quem lê
-- a tela sem conhecer o código.
update public.permissions set label = 'Ver a aba de comissões no Caixa'
  where key = 'cash.commissions.view';
update public.permissions set label = 'Ver comissões dos outros profissionais'
  where key = 'commissions.view_all';
update public.permissions set label = 'Lançar pagamento de comissão'
  where key = 'commissions.manage';
update public.permissions set label = 'Abrir, fechar e lançar no caixa'
  where key = 'cash.manage';
update public.permissions set label = 'Abrir a tela do Caixa'
  where key = 'cash.view';

-- Todas as cash.* moram em Financeiro; esta estava sozinha numa categoria
-- "Caixa", virando um grupo órfão de um item só na tela de Acessos.
update public.permissions set category = 'Financeiro' where key = 'cash.discount';

-- ── Chaves novas ─────────────────────────────────────────────────────────
insert into public.permissions (key, label, category) values
  ('billing.manage',   'Ver e mudar plano, cartão e faturas',      'Assinatura'),
  ('whatsapp.manage',  'Conectar o WhatsApp e ligar as mensagens', 'Configurações'),
  ('gallery.manage',   'Publicar fotos na página pública',         'Crescimento'),
  ('marketing.manage', 'Criar artes de divulgação (usa créditos)', 'Crescimento'),
  ('campaigns.manage', 'Disparar campanhas e recuperar clientes',  'Crescimento')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_key, allowed) values
  ('manager', 'billing.manage', false), ('receptionist', 'billing.manage', false), ('professional', 'billing.manage', false),
  ('manager', 'whatsapp.manage', false), ('receptionist', 'whatsapp.manage', false), ('professional', 'whatsapp.manage', false),
  ('manager', 'gallery.manage', false), ('receptionist', 'gallery.manage', false), ('professional', 'gallery.manage', false),
  ('manager', 'marketing.manage', true), ('receptionist', 'marketing.manage', false), ('professional', 'marketing.manage', false),

  -- Única mudança de comportamento da migração: Recuperar dependia de
  -- clients.view, que é true pra todo mundo — ou seja, hoje até um
  -- profissional dispara mensagem pra base inteira. Recepção mantém (é
  -- trabalho dela); profissional perde, que é justamente a correção.
  ('manager', 'campaigns.manage', true), ('receptionist', 'campaigns.manage', true), ('professional', 'campaigns.manage', false)
on conflict (role, permission_key) do nothing;

-- Sem linha em role_permissions a permissão fica indefinida e a tela de
-- Acessos mostra célula vazia — ninguém sabe se está ligada.
insert into public.role_permissions (role, permission_key, allowed) values
  ('manager', 'cash.discount', true), ('receptionist', 'cash.discount', false), ('professional', 'cash.discount', false),
  ('professional', 'packages.manage', false)
on conflict (role, permission_key) do nothing;

-- ── Preserva o que cada salão já customizou ──────────────────────────────
-- Salão que concedeu salon.manage a um cargo esperava que isso incluísse
-- WhatsApp e Galeria (incluía). Sem copiar o ajuste, a migração tiraria.
insert into public.salon_role_permissions (salon_id, role, permission_key, allowed)
select s.salon_id, s.role, nova.key, s.allowed
from public.salon_role_permissions s
cross join (values ('billing.manage'), ('whatsapp.manage'), ('gallery.manage')) as nova(key)
where s.permission_key = 'salon.manage'
on conflict do nothing;

insert into public.salon_role_permissions (salon_id, role, permission_key, allowed)
select s.salon_id, s.role, nova.key, s.allowed
from public.salon_role_permissions s
cross join (values ('marketing.manage'), ('campaigns.manage')) as nova(key)
where s.permission_key = 'services.manage'
on conflict do nothing;

insert into public.member_permissions (member_id, permission_key, allowed)
select m.member_id, nova.key, m.allowed
from public.member_permissions m
cross join (values ('billing.manage'), ('whatsapp.manage'), ('gallery.manage')) as nova(key)
where m.permission_key = 'salon.manage'
on conflict do nothing;

insert into public.member_permissions (member_id, permission_key, allowed)
select m.member_id, nova.key, m.allowed
from public.member_permissions m
cross join (values ('marketing.manage'), ('campaigns.manage')) as nova(key)
where m.permission_key = 'services.manage'
on conflict do nothing;
