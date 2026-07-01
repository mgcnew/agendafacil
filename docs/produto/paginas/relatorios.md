# Relatórios

Rota: `/painel/[slug]/relatorios`
Arquivo principal: `src/app/painel/[slug]/relatorios/page.tsx` + `src/app/painel/[slug]/relatorios/ReportsView.tsx`

## Objetivo

Mostrar o desempenho do salão em um mês selecionável (faturamento, despesas, ticket médio, ranking de serviços/profissionais, ocupação por dia/horário e clientes atrasados para retorno), com exportação e um narrador que traduz os números em frases acionáveis.

## Funcionalidades

- Navegação por mês (seta anterior/próxima, bloqueada para o futuro), com recarga dos dados ao trocar.
- Exportação do mês corrente em PDF ou CSV/Excel (`export.ts`).
- Quatro abas:
  - **Financeiro**: KPIs (faturamento, despesas, líquido, ticket médio), gráfico de barras de faturamento por dia, distribuição por forma de pagamento.
  - **Serviços & Profissionais** (rótulo da aba: "Serviços & Profissionais", chave interna `operacional`): ranking de serviços mais vendidos (barra por receita) e tabela de desempenho por profissional (atendimentos, receita, comissão).
  - **Temperatura**: "Termômetro por dia da semana" (classifica cada dia aberto em quente/morno/frio pela receita relativa ao dia de pico) e heatmap dia × hora (intensidade de cor por faturamento). Dias frios trazem link direto para criar campanha de 15% pré-preenchida.
  - **Reativação**: lista de clientes que passaram do próprio ritmo de retorno, ordenados por urgência/valor, com botão de WhatsApp por cliente. Carrega sob demanda (não depende do período de mês) e pode chegar já aberta via deep-link (`?tab=reativacao`, usado pelo Dashboard).
- Estado vazio dedicado quando o mês não tem nenhum atendimento concluído.

## Permissões

Acesso à página inteira: dona/`owner` sempre tem acesso; demais membros precisam de `perms.has("reports.view")` (checado no server, `page.tsx`); sem isso são redirecionados para o painel. Também passa por `guardFeature(slug, "/relatorios")` (gate de plano/assinatura). Sem distinção adicional de aba dentro da página.

## Inteligência (IA)

Sim — card "narrador" (`Narrator`, `src/components/Narrator.tsx`) no topo de cada uma das 4 abas, com frases em linguagem natural geradas por regra determinística em código (não LLM), sempre com fallback e nunca disparando ação sozinho.

- **Financeiro** (`financeiroNarration`): compara mês atual com o anterior via 2 chamadas à RPC `report_overview`. Narra faturamento (variação %), ticket médio quando a variação é ≥5%, e alerta (tom de atenção, cor âmbar, link para aba Temperatura) quando a margem de despesas sobre faturamento piora ≥5 pontos percentuais em relação ao mês anterior.
- **Serviços & Profissionais** (`operacionalNarration`): destaca o profissional com maior receita no mês; se comparado ao mês anterior, ou alerta um serviço que caiu ≥30% em atendimentos (com piso de 3 atendimentos no mês anterior para aquele serviço), ou — na ausência de queda — comemora um profissional que cresceu ≥30% em atendimentos (mesmo piso de 3 no mês anterior).
- **Temperatura**: identifica o dia mais quente (maior receita) e, se houver um dia claramente frio entre os dias abertos, gera alerta com link "Criar promoção para aquecer este dia" (pré-preenche campanha de 15%).
- **Reativação**: frase com a quantidade total de clientes atrasados e o nome do mais urgente (maior atraso sobre o próprio ritmo de retorno).
- Guarda de amostra mínima aplicada em Serviços & Profissionais: comparações de serviço/profissional só disparam alerta/elogio se o mês anterior teve ≥3 atendimentos daquele item — evita que 1 atendimento vire "queda de 100%".

Exemplos de frase: "Faturamento de R$X este mês, 12% a mais que em Junho 2026.", "Sexta é seu dia mais quente: R$X e 80% de ocupação.", "Você tem 5 clientes que já passaram do próprio ritmo de retorno. A mais urgente é Maria, 9 dias além do previsto."

## Dados / Backend

- RPC `report_overview(p_salon, p_from, p_to)`: usada 2x por carregamento (mês atual + mês anterior) para as abas Financeiro e Serviços & Profissionais.
- RPC `report_heatmap(p_salon, p_from, p_to)`: aba Temperatura.
- RPC `report_reactivation(p_salon, p_min_days)`: aba Reativação (mesma RPC usada no Dashboard, em Clientes e em Pacotes).

## Observações

- Bug já corrigido (2026-07-01): `report_overview` não caía para `profiles.full_name` quando o membro não tinha `display_name`, mostrando "Profissional" genérico — corrigido via migration ajustando o `coalesce`.
- Sobreposição conceitual pendente de decisão: aba Reativação (`report_reactivation`) vs. balde `inactive` de Recuperação de clientes (`marketing_winback`) — ainda não unificados.
- Percentual de desconto do link de campanha de "dia frio" é fixo em 15% — não varia por dados/margem do serviço.
- Não há envio automático de resumo semanal/mensal (WhatsApp/e-mail) — toda ação de contato depende de clique manual do usuário.
