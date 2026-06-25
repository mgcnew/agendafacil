-- Permissões para as abas de Comissões e Custos fixos dentro do Caixa.
-- Ideia: a recepcionista vê só o Caixa por padrão; comissões/fixos só se o
-- dono liberar (override por pessoa em member_permissions). Owner já recebe
-- tudo (resolvido no app). Manager vê por padrão; recepção/profissional não.

insert into public.permissions (key, label, category) values
  ('cash.commissions.view', 'Ver comissões', 'Financeiro'),
  ('cash.fixed.view', 'Ver custos fixos', 'Financeiro')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_key, allowed) values
  ('manager',      'cash.commissions.view', true),
  ('receptionist', 'cash.commissions.view', false),
  ('professional', 'cash.commissions.view', false),
  ('manager',      'cash.fixed.view',       true),
  ('receptionist', 'cash.fixed.view',       false),
  ('professional', 'cash.fixed.view',       false)
on conflict (role, permission_key) do nothing;
