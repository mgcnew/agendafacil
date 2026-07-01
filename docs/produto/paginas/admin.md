# Painel da Plataforma (Admin)

Rota: `/admin`
Arquivo principal: `src/app/admin/page.tsx`, `src/app/admin/AdminDashboard.tsx`, `src/app/admin/actions.ts`

## Objetivo

Painel super-admin da plataforma (fora do escopo de qualquer salão) para acompanhar métricas de negócio (MRR/ARR/churn), gerenciar assinaturas de todos os salões, administrar quem tem acesso admin e publicar avisos globais.

## Funcionalidades

Organizado em 5 abas:

- **Atenção**: lista consolidada de salões que precisam de ação — trials vencendo em até 3 dias, inadimplentes (`past_due`) e salões parados (ativos/trial sem atividade há 21+ dias). Cada item abre o modal de gerenciamento.
- **Visão geral**: KPIs (MRR, ARR, ARPU, conversão de trial, churn 30d, novos no mês, totais por status) e dois gráficos (evolução de MRR — usa histórico real de `admin_mrr_history` quando há 2+ pontos, senão estimativa; novos salões nos últimos 12 meses).
- **Salões**: lista completa com busca (nome/link/dono/e-mail) e filtro por status; indicador de saúde por bolinha de cor conforme dias desde a última atividade; exportação da lista filtrada para CSV; botão "Gerenciar" por salão abre modal com:
  - Estender trial (em dias).
  - Trocar plano do salão (RPC `admin_set_plan`).
  - Ativar cortesia (`admin_set_status` → `active`) ou bloquear (`admin_set_status` → `canceled`).
  - Consultar cobranças do salão no Asaas sob demanda (`getSalonBilling`) — lista de faturas com status/valor/vencimento/link de 2ª via.
  - Cobrança proativa: se há fatura vencida/pendente, gera link de WhatsApp (`wa.me`) e/ou `mailto:` com mensagem de cobrança pré-preenchida usando telefone/e-mail do dono.
  - Link direto para abrir o painel daquele salão em nova aba.
- **Administração**: gerenciar administradores da plataforma (adicionar por e-mail via `admin_add_admin`, remover via `admin_remove_admin` — não é possível remover a si mesmo) e ver log de auditoria das ações administrativas recentes (`admin_audit`, últimas 30).
- **Avisos**: criar anúncios globais (mensagem, tipo informativo/aviso/novidade, link opcional) que aparecem como banner no painel de todos os salões; ativar/desativar/excluir avisos existentes.

## Permissões

- Acesso à rota exige usuário autenticado **e** ser admin da plataforma: checado via RPC `is_platform_admin()` no servidor (`page.tsx`); sem isso, redireciona para `/`.
- A tabela de administradores é `platform_admins`; a autorização usada no restante das ações também é sempre revalidada via `is_platform_admin()` no servidor (ex. `getSalonBilling` em `actions.ts`), nunca confiando só no fato de a página ter carregado.
- Não há sub-permissões dentro do admin — quem é admin da plataforma tem acesso total às 5 abas.

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento.

## Dados / Backend

- Tabela: `platform_admins`.
- RPCs: `is_platform_admin`, `admin_metrics`, `admin_list_salons`, `admin_list_admins`, `admin_audit`, `admin_list_announcements`, `admin_mrr_history`, `admin_add_admin`, `admin_remove_admin`, `admin_extend_trial`, `admin_set_plan`, `admin_set_status`, `admin_create_announcement`, `admin_set_announcement_active`, `admin_delete_announcement`.
- Integração externa: Asaas (`asaasListSubscriptionPayments`, via `getSalonBilling`) para exibir cobranças reais do salão.
- Migrations relevantes em `supabase/migrations/`: `20260622_platform_admin.sql`, `20260622_admin_metrics.sql`, `20260622_admin_audit.sql`, `20260622_admin_salon_health.sql`, `20260622_announcements.sql`, `20260622_mrr_snapshots.sql`.

## Observações

Todas as chamadas de mutação usam RPCs `SECURITY DEFINER` chamadas diretamente do client Supabase do navegador (`createClient()` client-side) — a proteção real fica na própria função do banco (que deve validar `is_platform_admin()` internamente), não numa Server Action.
