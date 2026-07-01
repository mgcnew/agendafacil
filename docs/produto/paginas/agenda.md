# Agenda

Rota: `/painel/[slug]/agenda`
Arquivo principal: `src/app/painel/[slug]/agenda/page.tsx` (server) + `src/app/painel/[slug]/agenda/AgendaManager.tsx` (client, ~2170 linhas)

## Objetivo

Gerenciar a agenda de atendimentos do salão: visualizar, criar, remarcar (via seleção de horário), confirmar, finalizar e cancelar agendamentos, além de bloquear horários dos profissionais.

## Funcionalidades

- Três visualizações: Dia, Semana, Mês (`view` = `dia`/`semana`/`mes`), navegação por data com setas e calendário (`Calendar`).
- Filtro por profissional (seleção múltipla de `selectedPros`), com cores por profissional/serviço aplicadas aos cards de agendamento.
- Grade de horários (DayView), lista compacta (AgendaList) e visão mensal com até N eventos por dia + "+X mais".
- Criação de agendamento (`CreateAppointment`): busca/seleciona cliente existente ou cadastra nome/telefone novo, escolhe profissional, um ou mais serviços (com desconto de campanha aplicado via RPC `public_campaign_discounts`), data e horário; horários disponíveis vêm da RPC `get_availability`. Grava via RPC `create_staff_appointment`.
- Detalhe do agendamento (`ApptDetailModal`): dados do cliente, alerta de restrições (`clients.alert_summary`), serviços e total, troca de status (select com todos os status), atalho "Lembrar pelo WhatsApp" (mensagem pré-pronta), botão "Finalizar atendimento", histórico dos últimos 10 atendimentos do cliente (expansível) e ficha de anamnese (expansível, tabela `client_anamnesis`, condições de saúde de `HEALTH_CONDITIONS`).
- Finalização de atendimento (`FinalizeModal`): escolha de forma de pagamento e chamada à RPC `finalize_appointment`; alerta caso gere estoque negativo.
- Marcar "Faltou" (no_show) e cancelar diretamente pela troca de status.
- Bloqueio de horário (`BlockModal`): bloqueia um intervalo na agenda de um profissional específico ou do salão inteiro (grava em `schedule_blocks`), com motivo opcional. Quem não tem `schedule.manage` só pode bloquear a própria agenda (`selfOnly`).
- Exclusão de bloqueios de horário (sujeito às mesmas regras de permissão).
- Banner "De olho na agenda de hoje" (`AgendaSignalsBanner`) acima do calendário, sempre referente ao dia atual independente da data navegada — ver seção Inteligência.

## Permissões

- `getEffectivePermissions` calcula `canManageSchedule = perms.has("schedule.manage")`, passado ao componente.
- Quem não tem `schedule.manage` só enxerga/gerencia bloqueios da própria agenda (`myMemberId`); a opção "Todos (salão inteiro)" ao bloquear horário só aparece para quem tem a permissão.
- `canBlock = canManageSchedule || iAmPro` (qualquer profissional pode bloquear a própria agenda mesmo sem a permissão de gestão).
- Estimativa de faturamento dos horários vazios (ver Inteligência) depende da permissão `reports.view` na RPC — sem ela, a RPC nega e o chip degrada para mostrar só a contagem de horários livres, sem valor estimado.

## Inteligência (IA)

Não usa LLM — é um banner de sinais calculado por regra direta ("sem LLM", conforme comentário no código e confirmado no roadmap de IA). Ainda assim, funciona como o "narrador" da página (mesmo padrão visual/tom do Gestor Zulan):

- Sinais calculados sobre os dados já carregados do dia atual:
  - Cancelamentos do dia (`cancelled`).
  - Clientes atrasados: agendamentos cujo horário já passou e status ainda `pending`/`confirmed` (`lateClients`), cada um com botão de lembrete via WhatsApp.
  - Horários vazios do dia (`emptySlots`), calculados reaproveitando a RPC `get_availability`, deduplicados em blocos de 30 min não sobrepostos por profissional.
  - Estimativa de faturamento se todos os horários vazios forem preenchidos (`estimatedRevenue`), usando `agenda_revenue_by_hour` (RPC) — só é exibida se houver amostra mínima de `sample_count >= 3` atendimentos concluídos naquele bucket de horário; caso contrário fica `null` e o chip mostra só a contagem de horários livres.
- Texto sempre em tom de "funcionário avisando o dono" com ação de 1 clique (ex.: "Um horário cancelou hoje e ficou livre. Posso te mostrar quem pode vir no lugar." com link para `/painel/[slug]/recuperar`).
- Banner some por completo se não houver nenhum sinal relevante (sem cancelamento, atraso ou vaga).
- Não há efeito de "digitação" (`TypewriterText`) aqui — é cálculo instantâneo, não resposta de IA atrás de espera real.

## Dados / Backend

- Tabelas: `appointments`, `appointment_services`, `clients`, `salon_members`, `services`, `professional_services`, `schedule_blocks`, `client_anamnesis`.
- RPCs: `public_campaign_discounts`, `get_availability`, `create_staff_appointment`, `finalize_appointment`, `agenda_revenue_by_hour`.
- `getMembershipBySlug`, `getEffectivePermissions`.

## Observações

- Página roda com `export const dynamic = "force-dynamic"`.
- Lista de profissionais exibida na agenda só inclui quem tem ao menos um serviço atribuído (`professional_services`).
