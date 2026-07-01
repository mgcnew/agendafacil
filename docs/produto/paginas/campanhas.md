# Campanhas

Rota: `/painel/[slug]/campanhas`
Arquivo principal: `src/app/painel/[slug]/campanhas/page.tsx` + `src/app/painel/[slug]/campanhas/CampaignsManager.tsx`

## Objetivo

Permitir aplicar desconto percentual por período (todos os serviços ou um subconjunto) sem alterar o preço cadastrado de cada serviço, e medir se cada campanha efetivamente gerou agendamento/receita.

## Funcionalidades

- Listagem de campanhas do salão, mais recentes primeiro, com status calculado (`Ativa`, `Agendada`, `Encerrada`, `Pausada`) a partir de `is_active`/`starts_on`/`ends_on` comparados à data de hoje.
- Criar campanha: nome, desconto percentual (1–100%), escopo (`Todos os serviços` ou `Serviços específicos`, com seleção multi-serviço — serviços "sob consulta" ficam desabilitados e não recebem desconto), período opcional (início/fim via `Calendar` próprio do sistema, sem período a campanha vale enquanto ativa) e toggle "Campanha ativa".
- Editar campanha existente (mesmo formulário).
- Pausar/ativar campanha com 1 clique (toggle `is_active`).
- Excluir campanha (com confirmação nativa `confirm()`).
- Cada card de campanha ativa/agendada com dado mostra: nº de agendamentos, receita gerada e desconto concedido no período medido; sem dado, mostra "Ainda sem agendamentos com esta campanha."; campanhas encerradas/pausadas sem dado não mostram nada.
- Aviso fixo no topo (quando há campanhas) informando que a medição de performance só existe a partir de 01/07/2026 — não há atribuição retroativa.
- Suporte a pré-preenchimento do formulário de criação via querystring (`?nova=1&nome=...&desconto=...`), usado por links vindos de Relatórios (Termômetro/dia frio) e de Recuperação de clientes (sugestão de reativação); a URL é limpa após abrir o modal.

## Permissões

Acesso à página inteira exige `perms.has("services.manage")` (checado no server, `page.tsx`); sem essa permissão o usuário é redirecionado para o painel. Também passa por `guardFeature(slug, "/campanhas")` (gate de plano/assinatura). Não há distinção adicional de role dentro da página — quem acessa pode criar/editar/pausar/excluir livremente.

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento. A página não usa o componente `Narrator`; a medição de performance por campanha é cálculo direto de RPC, sem narração em linguagem natural.

## Dados / Backend

- Tabelas: `campaigns`, `services`, `campaign_services`.
- RPC `campaign_performance(p_salon)`: agendamentos, receita e desconto concedido por campanha, apenas sobre atendimentos `completed`, a partir da atribuição gravada desde 01/07/2026 (migration `20260701_campaign_performance_attribution.sql`).
- Atribuição de campanha ocorre no momento do agendamento (`_appt_fill`, usada por `book_appointment` e `create_staff_appointment`), gravando `campaign_id` e `original_price` em `appointment_services`.

## Observações

- Medição de performance cobre apenas serviços (`appointment_services`); venda de produto no caixa não é atribuída a campanha (`cash_sell_product` não grava `campaign_id`).
- Não há atribuição retroativa: campanhas encerradas antes de 01/07/2026 sempre aparecem com métricas zeradas — comportamento esperado, não bug.
- Escolha de público/horário/texto e disparo automático de campanha não existem — toda campanha é criada manualmente pelo dono/gestor.
