# Recuperação de clientes

Rota: `/painel/[slug]/recuperar`
Arquivo principal: `src/app/painel/[slug]/recuperar/page.tsx` + `src/app/painel/[slug]/recuperar/RecuperarManager.tsx`

## Objetivo

Dar ao dono uma lista acionável de clientes que faltaram, cancelaram ou sumiram, com mensagem de WhatsApp pronta para chamar cada um de volta em 1 clique.

## Funcionalidades

- Três abas/baldes: "Faltaram" (no-shows), "Cancelaram", "Inativos" — cada um com contador.
- Busca por nome dentro do balde ativo.
- Ajuste de período: janela em dias (30/60/90/180) para Faltaram/Cancelaram; "inativo há mais de" (30/45/60/90 dias) para a aba Inativos. Troca de período refaz a RPC.
- Cupom opcional anexado à mensagem: seletor de campanhas ativas do salão; ao escolher, o texto de WhatsApp passa a citar nome do cupom e percentual de desconto.
- Botão "Chamar" por cliente: abre WhatsApp (`wa.me`) com mensagem pré-montada (variando o texto conforme o balde: falta, cancelamento ou inatividade), incluindo link de agendamento do salão; desabilitado quando o cliente não tem telefone cadastrado.
- Badge de risco ("N faltas") para clientes com 2+ faltas registradas.
- Banner "De olho na recuperação" (regra direta, sem LLM):
  - Destaque de 1 cliente prioritário, escolhido por `pickPriority()`: cliente fiel que sumiu (3+ visitas) tem prioridade sobre risco de falta recorrente (2+ no-shows), com fallback para o primeiro registro de qualquer balde. Vem com botão "Chamar {nome}" reaproveitando a mesma função de mensagem.
  - Sugestão de campanha de reativação quando o balde de inativos atinge 5+ clientes (`REACTIVATION_CAMPAIGN_MIN_INACTIVE`), com link para `/campanhas?nova=1&nome=Volta pra cá&desconto=15` (pré-preenche o editor de campanha).
- Performance do cupom selecionado: ao escolher um cupom, mostra quantos agendamentos e quanta receita ele já gerou (reaproveitando `campaign_performance`); sem dado, mostra "Esse cupom ainda não tem agendamento registrado."

## Permissões

Acesso à página inteira exige `perms.has("clients.view")` (checado no server, `page.tsx`); sem essa permissão o usuário é redirecionado para o painel. Também passa por `guardFeature(slug, "/recuperar")` (gate de plano/assinatura). Não há distinção adicional de role dentro da página.

## Inteligência (IA)

Não há LLM nesta página. O banner "De olho na recuperação" e a escolha do cliente prioritário (`pickPriority()`) são regra direta em código (sem chamada a modelo de linguagem), mas seguem o mesmo padrão de tom/apresentação adotado nas páginas com narrador de IA (frase em linguagem natural + ação de 1 clique). Foi o protótipo que inspirou esse padrão, replicado depois no Dashboard e em Relatórios/Financeiro.

Guardas de amostra mínima aplicadas nas regras:
- Cliente "fiel que sumiu" só é destacado com 3+ visitas históricas.
- Cliente "risco de falta recorrente" só é destacado com 2+ faltas.
- Sugestão de campanha de reativação só aparece com 5+ clientes no balde de inativos.

## Dados / Backend

- RPC `marketing_winback(p_salon, p_window_days, p_inactive_days)`: retorna os três baldes (`no_shows`, `cancelled`, `inactive`) com nome, telefone, última data, nº de faltas/visitas conforme o balde.
- RPC `campaign_performance(p_salon)`: reaproveitada para mostrar performance do cupom selecionado.
- Tabela `campaigns` (apenas campanhas ativas) para popular o seletor de cupom.

## Observações

- Mensagem de WhatsApp é template estático por balde (não personalizada por IA com base em serviço favorito ou histórico do cliente).
- Não usa `birth_date`/tempo de casa (`created_at`) para priorização — `pickPriority()` cobre só fidelidade (visitas) e risco de falta (no-shows).
- Escolha de público/horário/texto e envio automático continuam fora de escopo — todo envio depende de clique manual do dono no botão "Chamar".
- Possível sobreposição conceitual entre o balde `inactive` desta página (RPC `marketing_winback`) e a métrica de "cliente parado" usada em `report_reactivation` (Dashboard/Clientes/Relatórios) — ainda não unificadas.
