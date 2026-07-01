# Dashboard

Rota: `/painel/[slug]`
Arquivo principal: `src/app/painel/[slug]/page.tsx`

## Objetivo

Dar ao dono/equipe uma visão consolidada do dia (agendamentos, faturamento previsto, pendências) ao abrir o painel, com atalhos rápidos para as ações mais comuns (novo agendamento, finalizar atendimento, lembrar clientes).

## Funcionalidades

- Cabeçalho com saudação (primeiro nome do usuário logado) e botão "Novo agendamento" (leva para `/painel/[slug]/agenda?novo=1`).
- Cards de estatística do dia: agendamentos hoje, previsão de faturamento hoje (exclui `cancelled`/`no_show`), serviços ativos, total de clientes.
- "Agenda de hoje" (componente `TodayAgenda`): lista os agendamentos do dia dividida em "próximos" e "aguardando baixa" (horário já passou e status ainda `pending`/`confirmed`, marcados como atrasados). Cada item é expansível e mostra serviços, alerta de anamnese do cliente (`clients.alert_summary`) e permite:
  - Finalizar atendimento via modal (`FinalizeModal`), escolhendo forma de pagamento (Dinheiro/Pix/Cartão) e chamando a RPC `finalize_appointment`; se a baixa gerar estoque negativo, exibe aviso com os produtos afetados.
  - Marcar "Faltou" (`no_show`) com atualização otimista.
- Sidebar contextual (coluna direita no desktop):
  - "Últimos atendimentos" — 6 últimos concluídos antes de hoje.
  - "Aniversariantes do mês" — janela de 31 dias (RPC `upcoming_birthdays`), com botão para parabenizar via link `wa.me` pré-preenchido.
  - Alerta "clientes para reativar" (RPC `report_reactivation`, `p_min_days: 14`) com link para relatório de reativação.
  - "Minhas comissões" — só aparece para quem tem role `professional` ou `manager` e cujo plano efetivo permite acesso a `/financeiro`; mostra apurado, já pago e a receber no mês corrente (soma `appointment_services.commission_amount` + `package_redemptions.commission_amount`, subtrai `commission_payments`).
  - "Lembretes de amanhã" (componente `TomorrowReminders`) — agendamentos `pending`/`confirmed` do dia seguinte, com botão de lembrete via WhatsApp por cliente.
  - "Pacotes ativos" — até 6 pacotes de clientes com status `active`, ordenados por vencimento, com badge de dias restantes.
- Componentes `BirthdayCard` e `TypewriterText` existem no diretório mas `BirthdayCard` não é usado nesta página (a lista de aniversariantes do dashboard é renderizada inline em `page.tsx`); `TypewriterText` é usado dentro do card de IA (ver abaixo).

## Permissões

Sem controle de permissão granular na página em si (visível a qualquer membro com acesso ao painel do salão). A única exceção é o bloco "Minhas comissões", restrito por role (`professional`/`manager`) e por plano (`planAllowsHref` checando se o plano efetivo do salão permite a rota `/financeiro`).

## Inteligência (IA)

Sim — bloco "Gestor Zulan" no topo da coluna principal (`GestorInsights.tsx`), renderizado atrás de `Suspense` para não bloquear o resto do dashboard.

- Fonte: `src/lib/ai/dashboardInsights.ts`, usando modelo `deepseek-chat` via SDK compatível com OpenAI (`src/lib/ai/deepseek.ts`), configurado por `DEEPSEEK_API_KEY`.
- Funcionamento: os sinais do dia (agendamentos hoje, faturamento previsto, clientes p/ reativar, aniversariantes hoje/em breve, pacotes vencendo em até 3 dias, produtos no estoque mínimo) são calculados por SQL/RPC no servidor — a IA **nunca calcula números**, só narra/prioriza. Um prompt de sistema instrui o modelo a soar como recepcionista humana, usar só os dados fornecidos e devolver no máximo 4 insights via tool-calling (`report_insights`), cada um com `type`, `title`, `detail` e `priority` (alta/media/baixa).
- Cache: resultado é salvo em `ai_dashboard_insights` (chave `salon_id + date`), gerado uma vez por salão por dia. Botão de refresh (`RefreshGestorButton`) ignora o cache e força nova geração (server action `refreshGestorInsights`).
- Modo stub: se `DEEPSEEK_API_KEY` não estiver configurada, ou a chamada falhar por qualquer motivo, cai automaticamente em `stubPayload` — um conjunto de insights determinísticos gerados por regras simples a partir dos mesmos sinais (não é IA, é fallback textual fixo). Nunca quebra a página.
- Insight de aniversário tem tratamento especial: a IA só narra o texto, mas os botões de "Parabenizar" com link de WhatsApp por cliente são montados pelo código com dados reais (nome/telefone), não pela IA.
- Efeito de "digitação" (`TypewriterText`) no texto do cabeçalho do card e na mensagem de "tudo tranquilo", simulando resposta sendo escrita (cap de 700ms, respeita `prefers-reduced-motion`).
- Exemplos de texto de cabeçalho: "Encontrei isso hoje pra você" (há insights) / "Já passei pelo salão hoje" (sem insights) / "Tudo tranquilo por aqui — sem pendência ou oportunidade pra te mostrar agora."

## Dados / Backend

- Tabelas: `appointments`, `appointment_services`, `clients`, `salon_members`, `services`, `profiles`, `client_packages`, `client_package_items`, `products`, `commission_payments`, `package_redemptions`, `ai_dashboard_insights`.
- RPCs: `report_reactivation`, `upcoming_birthdays`, `finalize_appointment`.
- `getMembershipBySlug`, `getAccessStatus`, `planAllowsHref` (controle de acesso/plano).

## Observações

- A página roda com `export const dynamic = "force-dynamic"` — sempre renderizada no servidor a cada acesso, sem cache de rota.
- "Hoje"/"amanhã" são calculados no fuso do Brasil via helpers `startOfTodayBR`/`startOfTomorrowBR` (o servidor roda em UTC em produção).
