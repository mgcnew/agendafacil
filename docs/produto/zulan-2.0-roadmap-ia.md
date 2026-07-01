# ZULAN 2.0 — Roadmap de implementação da IA por página

> Diferente dos outros documentos em `docs/produto/` (que são visão estática — bíblia, arquitetura, manifesto), **este é um documento vivo**: deve ser atualizado toda vez que decidirmos o escopo de uma fase, adiarmos algo pra depois, ou concluirmos uma implementação. Serve pra não perder o raciocínio de "por que ficou de fora" quando alguém (inclusive eu, em uma sessão futura) revisitar o assunto.
>
> Referência de visão completa por página: [zulan-2.0-documento-funcional-das-paginas.md](zulan-2.0-documento-funcional-das-paginas.md).

## Legenda de status

- ✅ **Implementado** — em produção
- 🔧 **Em andamento** — sendo construído nesta fase
- 🔜 **Planejado (v1)** — escopo definido, ainda não construído
- ⏳ **Adiado (v2+)** — avaliado e conscientemente deixado pra depois, com motivo registrado
- ⬜ **Não avaliado** — ainda não chegamos nessa página

---

## Dashboard (Visão geral)

**Status: ✅ Implementado** (2026-06-30)

- Card **"Gestor Zulan"** (nome definido pelo usuário em 2026-06-30 — é o cargo mais importante da equipe virtual, coordenador dos demais) no topo da Visão geral, narra (não calcula) sinais já existentes: clientes pra reativar, aniversariantes, pacotes vencendo, faturamento do dia.
- IA: DeepSeek via tool calling (schema fixo), cache de 1x/dia por salão (`ai_dashboard_insights`), fallback determinístico sem IA.
- **Aniversário ganhou ação real:** o insight de aniversário (tipo `birthday`) vem com botão "Parabenizar {nome}" por cliente — WhatsApp pré-preenchido, um por aniversariante do dia. A lista de contatos (id/nome/telefone) é passada por fora do que a IA narra — a IA só decide *se* menciona aniversário e como, o código injeta o(s) link(s) de ação reais (mesmo princípio do "Lembrar" da Agenda: nenhum dado de contato é inventado pela IA, e nada é enviado sem o dono clicar). **Sem autonomia de disparo automático ainda** — fica pra uma fase futura, por decisão explícita do usuário ("nesse primeiro momento ele não tem autonomia para mandar sozinho, mas futuramente faremos isso").
- UX: streaming via Suspense (não bloqueia o resto da página), botão de atualizar manual (Server Action, ignora cache do dia).
- UX: o texto chega e é "digitado" (`TypewriterText.tsx`, cap de 700ms, respeita `prefers-reduced-motion`, texto completo sempre disponível pra leitor de tela via `sr-only`) — cards de insight entram em sequência (`af-rise` com delay escalonado). Decisão registrada (2026-06-30): isso só se justifica aqui porque a demora (resposta do DeepSeek) **já é real** — é decorar um tempo que ia existir de qualquer jeito, não inventar atraso novo. Por isso esse efeito **não** foi replicado no banner da Agenda (cálculo ali é instantâneo; "digitar" algo que não levou tempo nenhum pra calcular seria encenação enganosa, fere o princípio de performance).
- Arquivos: `src/lib/ai/dashboardInsights.ts`, `src/lib/ai/deepseek.ts`, `src/app/painel/[slug]/GestorInsights.tsx`, `RefreshGestorButton.tsx`, `gestorActions.ts`, `TypewriterText.tsx`.

**Não incluído de propósito:** insight de "receita do dia" no modo stub (só no modo live); ação autônoma (a IA só narra e linka, nunca dispara mensagem sozinha).

---

## Agenda

**Status: ✅ Implementado (v1 + parte da v2)** (2026-06-30)

### v1 — sinais fáceis, sem RPC nova
Banner acima do calendário (`AgendaSignalsBanner`), regra direta (sem LLM), sempre reflete "hoje" independente da view/data navegada:
- Cancelamentos do dia
- Clientes atrasados (`starts_at` passado, status ainda `pending`/`confirmed`)
- Horários vazios de hoje (reaproveita a RPC `get_availability` já existente, deduplicado em blocos de 30min não sobrepostos por profissional)

### v2 — estimativa de faturamento dos horários vazios
Implementada junto, mais cedo do que o planejado original, a pedido do usuário ("na medida que os salões forem usando e criando histórico essa funcionalidade vai se fazer importante").

- Nova RPC `agenda_revenue_by_hour(p_salon, p_weekday, p_window_days=90)`: ticket médio histórico por hora, no mesmo dia da semana, últimos 90 dias. Gate por `reports.view` (mesmo padrão de `report_reactivation`).
- **Guard de amostra mínima:** só usa o ticket médio de uma hora se houver `sample_count >= 3` atendimentos concluídos naquele bucket — sem isso, a hora fica de fora do cálculo (em vez de mostrar estimativa enganosa).
- Estimativa some sozinha se a amostra for insuficiente (`estimatedRevenue: null`) — o chip mostra só a contagem de horários livres, sem valor chutado.
- Sem permissão de `reports.view`, a RPC nega e a estimativa degrada graciosamente (chip continua mostrando só a contagem).
- Arquivo: `supabase/migrations/20260630_agenda_revenue_estimate.sql`, lógica em `AgendaManager.tsx` (`loadTodaySignals`).

### Banner reescrito: tom de equipe + ação de 1 clique (2026-06-30)
Banner deixou de ser uma fileira de chips com números e virou cartões com voz de funcionário propondo solução (ver Princípio 6/7 abaixo):
- **Cliente atrasado** → "Fulano ainda não chegou pro horário das 14h. Quer que eu avise?" + botão "Lembrar" que abre WhatsApp com mensagem pronta (mensagem montada em código, não por LLM — continua v1/v2, sem custo de IA).
- **Cancelamento** → "Um horário cancelou e ficou livre. Posso te mostrar quem pode vir no lugar." + link pra `/recuperar`.
- **Horário vazio** → soma a estimativa de faturamento na própria frase + link pra `/recuperar`.

### Adiado, motivo registrado (2026-06-30)
Avaliado e **conscientemente adiado**, não esquecido:

| Sinal | Por que não entra ainda |
|---|---|
| Dias fracos | Precisa de RPC nova comparando ocupação média por dia da semana ao longo do tempo (diferente do ticket médio por hora já implementado) |
| Oportunidades de encaixe | Precisa cruzar gap livre + duração de serviço + lista de clientes parados (`/recuperar`) — acopla dois módulos hoje independentes |

**Ações inteligentes (remarcar cliente, preencher horário sozinho, abrir horário extra) — fora de escopo até existir um fluxo de aprovação.** Isso é ação autônoma de risco médio/alto pela hierarquia de decisões definida em [zulan-2.0-arquitetura-da-ia.md](zulan-2.0-arquitetura-da-ia.md); não deve ser construído sem esse fluxo existir primeiro.

---

## Clientes

**Status: ✅ Implementado (v1)** (2026-06-30)

A página com mais reaproveitamento de dado/RPC já existente entre todas que tratamos até aqui — quase tudo do v1 já estava calculado em outro lugar do sistema, só não exposto no perfil do cliente.

### v1 — sinais fáceis, reaproveitando RPCs já existentes
- **Aniversário no perfil**: badge no cabeçalho quando faltam ≤7 dias (`nextBirthday()` em `src/lib/clients.ts`, a partir do `birth_date` já cadastrado).
- **Profissional favorito**: agregação simples sobre o histórico completo de atendimentos concluídos do cliente (mais frequente).
- **Faltas e cancelamentos no perfil**: contagem direta sobre os agendamentos do cliente (antes só existia agregado, dentro do `/recuperar`).
- **Selo de Cliente VIP** (lista e perfil): top 20% de gasto entre clientes com 2+ visitas — **com guard de amostra mínima** (precisa de pelo menos 5 clientes elegíveis no salão, senão ninguém é marcado VIP). Lógica em `computeVipIds()`, `src/lib/clients.ts`.
- **"Previsão de abandono" no perfil**: reaproveita a fórmula já validada do `report_reactivation` (mesma RPC do `/recuperar`) — mostra "está X dias acima do ritmo normal dela(e)" quando aplicável.
- **"Lembrar retorno"** — ação de 1 clique (WhatsApp pré-preenchido), aparece junto da previsão de abandono. Mesmo princípio de sempre: a IA narra o sinal, o código monta o link com dado real, o clique do dono autoriza.
- Arquivos: `src/lib/clients.ts` (novo, compartilhado entre lista e perfil), `clientes/page.tsx`, `clientes/ClientsManager.tsx`, `clientes/[id]/page.tsx`, `clientes/[id]/ClientDetail.tsx`.

### Adiado, motivo registrado (2026-06-30)
| Sinal | Por que não entra ainda |
|---|---|
| Produtos/serviços preferidos | Precisa de RPC nova juntando `appointment_services` por cliente — não é leitura direta de dado já calculado |
| Potencial de compra | Precisa de um score de verdade (ex.: RFM), não é leitura direta — modelo ainda não definido |
| Sugestão automática de campanha por cliente | Faz mais sentido morar no roadmap de **Campanhas** (ainda não avaliado) do que no perfil individual |

---

## Recuperação de clientes

**Status: ✅ Implementado (base + v1)** (anterior ao reposicionamento Zulan 2.0; v1 de IA em 2026-07-01)

- `/recuperar`: tabs no_shows / cancelled / inactive, busca por nome, ajuste de período, RPC `marketing_winback`, WhatsApp 1-clique com cupom opcional.
- Foi o protótipo que inspirou o padrão "narrar dados confiáveis" usado depois no Dashboard.

O documento funcional descreve a página com autonomia total (IA escolhe público/horário/texto, envia e aprende sozinha) — conflita com o Princípio 2 e não tem fluxo de aprovação; não foi construído assim. Era, até 2026-07-01, a única página madura sem a camada de "banner que fala com o dono" já dada às demais.

### v1 — três etapas, cada uma commitada/verificada em separado (2026-07-01)
1. **Banner "De olho na recuperação"** — regra direta, sem LLM, reaproveita os 3 baldes que `marketing_winback` já calcula (`total_no_shows`, `visits`, `last_at`). `pickPriority()` escolhe 1 cliente pra destacar: cliente fiel que sumiu (3+ visitas) > risco de falta recorrente (2+ no-shows) > fallback pro primeiro registro de qualquer balde, pra sempre mostrar algo útil quando há dado. Botão "Chamar" reaproveita a mesma função de mensagem/WhatsApp já usada na lista (`message`/`openWhatsApp` passaram a aceitar o bucket explícito em vez de depender só da tab ativa).
2. **Sugestão de campanha de reativação** — quando o balde de inativos atinge o piso mínimo (`REACTIVATION_CAMPAIGN_MIN_INACTIVE = 5`, mesmo padrão do selo VIP em Clientes), aparece um link pra `/campanhas?nova=1&nome=Volta%20pra%20c%C3%A1&desconto=15` — mesmo mecanismo que o Termômetro de Relatórios já usa pra "dia frio". Abaixo do piso, o grupo é pequeno demais pra justificar campanha (chamar 1 a 1 já resolve) e o card simplesmente não aparece.
3. **Performance do cupom selecionado** — fecha o loop "anexei esse cupom nas mensagens → quanto ele já trouxe": ao escolher um cupom, mostra agendamentos/receita gerados por ele, reaproveitando `campaign_performance()` (criada na v2 de Campanhas, ver seção Campanhas). Sem agendamento registrado, mostra "ainda não tem agendamento registrado" em vez de esconder o texto.
- Arquivos: `recuperar/RecuperarManager.tsx`, `recuperar/page.tsx`.

### Adiado, motivo registrado (2026-07-01)
| Item | Por que não entra ainda |
|---|---|
| Mensagem de WhatsApp personalizada por IA (serviço favorito, `notes`/`alert_summary`) | Precisa cruzar `service_insights` por cliente — mais plumbing; template estático hoje já cobre o essencial |
| Uso de `birth_date`/tempo de casa (`created_at`) pra priorizar quem chamar | Não entrou nesta rodada — `pickPriority()` já cobre os casos mais fortes (fidelidade + risco de falta) sem precisar desses campos |
| Escolha de público/horário/texto e envio automático pela IA | Descrito no documento funcional como autônomo — precisa do fluxo de aprovação da hierarquia de decisões antes de existir, mesmo em versão "propõe e o dono clica" |
| Unificar `marketing_winback.inactive` com `report_reactivation` (já usada em Dashboard/Clientes/Pacotes/Serviços) | Pode haver sobreposição conceitual entre as duas métricas de "cliente parado" — vale decidir/alinhar numa sessão futura, não travava o v1 |

---

## Serviços

**Status: ✅ Implementado (v1)** (2026-06-30)

Mesmo padrão de reaproveitamento de RPC já estabelecido (`clients_overview`, `agenda_revenue_by_hour`) — `appointment_services` já guardava preço e comissão reais (snapshotados no momento do atendimento), só não estavam agregados nem expostos.

### v1
- **Nova RPC `service_insights(p_salon, p_window_days=90)`**: agrupa `appointment_services` (atendimentos concluídos) por serviço — quantidade de agendamentos, receita real, comissão média real, última vez que foi pedido. Permissão: `is_salon_member` (mesmo padrão da `clients_overview`, não exige `reports.view` — é visível a quem gerencia o catálogo).
- **Lucro real vs. estimado**: quando há histórico (`bookings > 0`), a margem mostrada na lista passa a usar preço/comissão médios reais em vez dos valores de cadastro — só o custo de insumo continua estimado (não dá pra saber a quantidade exata consumida por atendimento específico, só a "receita" configurada). Rótulo muda de "lucro est." pra "lucro real" automaticamente.
- **Badge "parado há 90+ dias"**: serviço ativo sem nenhum agendamento concluído na janela.
- **Contador de agendamentos** (`Nx`) ao lado da duração/comissão na lista.
- Arquivos: `src/lib/serviceInsights.ts` (novo), `supabase/migrations/20260630_service_insights.sql`, `servicos/page.tsx`, `servicos/ServicesManager.tsx`.

### Adiado, motivo registrado (2026-06-30)
| Item | Por que não entra ainda |
|---|---|
| Alerta proativo de margem negativa / serviço parado | Hoje é só visual na lista (precisa abrir a página); virar alerta proativo (tipo o banner da Agenda/card do Dashboard) é next, mas precisa decidir onde aparece — Dashboard? Notificação? |
| Sugestão automática de reajuste de preço | Ação de risco médio (mexe em preço) — entra na hierarquia de decisões que exige confirmação; ainda não tem fluxo de aprovação pra esse tipo de ação |
| Serviço mais pedido por profissional | Precisa juntar `appointment_services` com `member_id` do agendamento — RPC dá pra estender, mas não entrou nesta rodada |

---

## Pacotes

**Status: ✅ Implementado (v1)** (2026-06-30)

A pedido do usuário: "teríamos uma inteligência guiando o dono na tomada de decisões, no momento de criar pacotes, como nos pacotes existentes" — ambos os momentos (criação e acompanhamento) entraram na v1.

### v1 — criação guiada
- No editor de modelo, card ao vivo (atualiza a cada serviço/quantidade adicionada) com: preço avulso somado, desconto efetivo do pacote, comissão estimada e **lucro estimado sem insumo**. Reaproveita `service_insights` (de Serviços) — usa comissão real média quando o serviço já tem histórico, senão cai pro `commission_percent` do cadastro.
- Aviso quando o desconto efetivo é negativo (pacote mais caro que comprar avulso).
- **Não inclui custo de insumo** — deixaria a página de Pacotes dependente de buscar `service_products`/`products`, que ela hoje não carrega. Rotulado claramente como "sem insumo" pra não passar precisão que não tem.

### v1 — pacotes já vendidos
- Banner "De olho nos pacotes" (mesmo padrão visual do Dashboard/Agenda) na aba Vendidos:
  - **Pacote parado**: comprado, zero sessão usada, 14+ dias — com botão "Lembrar {nome}" (WhatsApp pré-preenchido) por cliente.
  - **Vencendo em 7 dias**: contagem consolidada (o detalhe por pacote já existia nos cards, só não havia visão agregada).
- Arquivos: `src/lib/serviceInsights.ts` (reaproveitado), `pacotes/page.tsx`, `pacotes/PackagesManager.tsx`.

### Adiado, motivo registrado (2026-06-30)
| Item | Por que não entra ainda |
|---|---|
| Modelo mais vendido / receita por modelo | Precisa de nova agregação por `template_id` sobre `client_packages` — não é leitura direta |
| Margem incluindo custo de insumo | Precisa carregar `service_products`/`products` na página de Pacotes (hoje não carrega) — mais plumbing, ficou pra quando o ganho justificar |
| Sugestão automática do preço "ideal" | Mesmo motivo de sempre: amostra pequena vira chute. v1 mostra a informação pro dono decidir (Princípio 6), não decide por ele |

---

## Estoque

**Status: ✅ Implementado (v1)** (2026-06-30)

Correção importante descoberta durante a análise: o relatório inicial (agente de exploração) dizia que a baixa de insumo por atendimento não era automática — **estava errado**. Conferido direto no banco: `finalize_appointment()` já baixa o estoque via `service_products` e grava em `stock_movements` (`type='out'`, `reason='Atendimento'`, `appointment_id` preenchido) desde antes desta sessão. `cash_sell_product()` também já baixa estoque de revenda. Ou seja, **já existia histórico real de consumo**, só não estava agregado nem exposto em lugar nenhum — diferente de Serviços/Pacotes, aqui não foi preciso "destravar" dado, foi só agregar o que já fluía.

### v1
- **Nova RPC `product_movement_stats(p_salon, p_window_days=30)`**: agrega `stock_movements` (saídas) por produto — quantidade consumida, nº de movimentações, última movimentação.
- **Lucro por produto de revenda**: `sale_price - cost_price`, mostrado direto na lista (cálculo simples, dado já existia, só não era exibido).
- **Consumo (30d)** e **"acaba em ~Nd"**: estimativa de dias até zerar com base no ritmo real de saída (`quantidade ÷ consumo diário médio`) — só aparece quando há consumo recente o suficiente pra calcular uma taxa (sem consumo no período, não estima nada, evita "infinito"/sem sentido).
- **Badge "parado há 30+ dias"**: produto de revenda ativo sem nenhuma saída na janela — mesmo princípio do "serviço parado"/"pacote parado".
- **Sinal no Dashboard**: `productsLowCount` (estoque mínimo) chegou até o card do Gestor — gap real que a análise encontrou (Pacotes já tinha `pkgsExpiringSoon` chegando lá, Estoque não tinha equivalente). Tipo de insight novo `low_stock`, mapeado pra `/estoque`.
- Arquivos: `src/lib/productInsights.ts` (novo), `supabase/migrations/20260630_product_movement_stats.sql`, `estoque/page.tsx`, `estoque/InventoryManager.tsx`, `src/lib/ai/dashboardInsights.ts`, Dashboard `page.tsx`, `GestorInsights.tsx`.

### UX: paginação e filtros (2026-07-01)
A pedido do usuário: estoque não é só insumo, é também produto de revenda vendido no caixa — precisava de filtro por tipo e por status, além de paginação.
- **Lista de produtos**: busca por nome, filtro por tipo (insumo/revenda) e por status (estoque baixo/parado), paginação de 15 itens (in-memory — catálogo é naturalmente pequeno e limitado).
- **Movimentações recentes**: correção de rumo importante — a paginação real (server-side) era pra esta lista, não pra de produtos, já que o histórico de movimentação cresce sem limite. Passou a carregar em lotes de 10 (`MOVEMENTS_PAGE_SIZE`) via nova Server Action `loadMoreMovements` (`estoque/inventoryActions.ts`), com botão "Carregar mais" — evita trazer todo o histórico de uma vez no primeiro load. Usa a técnica de buscar `N+1` linhas pra saber se há mais sem precisar de `count: "exact"` numa tabela que só cresce.
- Tipo `Movement` e a constante `MOVEMENTS_PAGE_SIZE` moraram num arquivo neutro (`estoque/types.ts`) sem diretiva `"use client"`/`"use server"` — necessário porque `InventoryManager.tsx` (client) e `inventoryActions.ts` (server action) importam o mesmo tipo/constante um do outro, e isso causa erro de resolução de módulo no Turbopack (`tsc` não pega, só aparece em runtime).
- Arquivos: `estoque/InventoryManager.tsx`, `estoque/page.tsx`, `estoque/types.ts` (novo), `estoque/inventoryActions.ts` (novo).

### Adiado, motivo registrado (2026-06-30)
| Item | Por que não entra ainda |
|---|---|
| Identificar desperdícios | `stock_movements.reason` só é preenchido automaticamente ('Atendimento') ou fica vazio — não existe taxonomia de motivo (quebra, validade, etc.) pro dono categorizar perdas. Precisa de UI nova antes de qualquer análise fazer sentido |
| Sugerir promoções (ação) | O badge "parado" já aponta o produto; faltar a ação de criar campanha pra ele depende do roadmap de **Campanhas**, ainda não avaliado |
| Sugerir compras automaticamente | Vai além de alertar — decidir quanto comprar e de quem é ação de risco médio (gasto real), precisa de fluxo de aprovação que não existe ainda |

---

## Inteligência do Negócio (Financeiro)

**Status: ⬜ Não avaliado**

---

## Equipe

**Status: ⬜ Não avaliado**

---

## Campanhas

**Status: ✅ Implementado (v2, pulando o v1)** (2026-07-01)

A visão do documento funcional ([zulan-2.0-documento-funcional-das-paginas.md](zulan-2.0-documento-funcional-das-paginas.md)) descreve campanha totalmente autônoma (IA escolhe público, horário, texto, envia e aprende sozinha) — conflita direto com o Princípio 2 (sem disparo automático sem confirmação do dono) e não tem fluxo de aprovação pra isso hoje. Não foi construída como está descrita lá.

Prova de que o padrão "IA propõe, dono clica pra criar" já existia antes mesmo de avaliarmos esta página: o "Termômetro por dia da semana" em Relatórios já linka pra `/campanhas?nova=1&nome=...&desconto=15` quando identifica um dia frio, e `CampaignsManager.tsx` já sabia abrir o editor pré-preenchido a partir desses parâmetros.

Ao analisar, ficou claro que faltava a base de tudo: **nenhum agendamento gravava qual campanha gerou seu desconto** — sem isso, não dá pra medir se uma campanha funciona. O usuário decidiu pular direto pro que resolve essa lacuna (v2) em vez de começar por sugestões mais simples de campanha (v1).

### v2 — medição de performance
- Migration `20260701_campaign_performance_attribution.sql`: `appointment_services` ganha `campaign_id` e `original_price`; `_appt_fill` (usada por `book_appointment` e `create_staff_appointment`) passa a resolver a campanha vencedora (`campaign_for_service`, mesma regra de elegibilidade que já existia em `campaign_discount`, só que agora também retorna o id) e grava os dois campos no momento do agendamento. `campaign_discount` foi reescrita por cima de `campaign_for_service`, mantendo assinatura/comportamento — não quebra `effective_price` nem `public_campaign_discounts`.
- Nova RPC `campaign_performance(p_salon)`: agendamentos, receita e desconto concedido por campanha, só sobre atendimentos `completed`. Gate por `is_salon_member` (mesmo padrão de `product_movement_stats`).
- UI em `CampaignsManager.tsx`: cada card de campanha mostra as três métricas (quando há dado), com aviso fixo no topo da página de que a medição só existe a partir de 01/07/2026 — **não há como reconstruir atribuição de agendamentos passados**, já que a campanha nunca foi gravada antes desta migration. Campanhas encerradas antes disso aparecem sempre zeradas, e isso é esperado, não bug.
- **Escopo desta v2: apenas serviços** (`appointment_services`). Venda de produto no caixa não é atribuída a campanha — decisão explícita do usuário ("nesse primeiro momento não precisamos estender para os produtos").
- Bônus fora do escopo original: os campos de data (Início/Fim) da modal de campanha usavam `<input type="date">` nativo do navegador (fora do tema); trocados pelo componente `Calendar` próprio do sistema (já usado na Agenda), com bloqueio de datas antes do início selecionado.
- Arquivos: `supabase/migrations/20260701_campaign_performance_attribution.sql`, `campanhas/page.tsx`, `campanhas/CampaignsManager.tsx`.

### Adiado, motivo registrado (2026-07-01)
| Item | Por que não entra ainda |
|---|---|
| v1 — banner de sugestões de campanha (clientes inativos, dormência de produto, dia frio) reaproveitando `report_reactivation`/`service_insights`/termômetro já existente | Avaliado antes da v2, mas o usuário optou por ir direto pra medição de performance; não foi rejeitado, só ficou pra depois |
| Escolha de público/horário/texto pela IA | Descrito no documento funcional como autônomo — precisa do fluxo de aprovação da hierarquia de decisões antes de existir, mesmo em versão "propõe e o dono clica" |
| Atribuição de campanha em venda de produto (caixa) | Fora do escopo desta v2 por decisão do usuário; `cash_sell_product` não grava `campaign_id` hoje |
| Envio automático de campanha (WhatsApp/notificação) | Ação de risco médio/alto — mesma barreira dos demais "envios autônomos" já adiados em outras páginas |

---

## Princípios que valem pra toda página (lições já aprendidas)

1. **A IA narra, não calcula.** Sinais vêm de SQL/RPC confiável; o LLM só prioriza e dá tom humano. (Ver [zulan-2.0-arquitetura-da-ia.md](zulan-2.0-arquitetura-da-ia.md).)
2. **Sem disparo automático sem o dono confirmar.** A IA nunca manda mensagem, aplica desconto ou remarca sozinha *sem um clique do dono* — mas isso não significa só "linkar pra outra página". Ver princípio 6.
3. **Cuidado com amostra pequena.** Qualquer insight baseado em histórico/tendência precisa de um piso mínimo de dados antes de aparecer — testado na prática com o Dashboard (salão de teste com 2 clientes não gerava nenhum insight até popularmos dados de seed).
4. **Streaming, nunca bloquear a página.** Chamada a LLM externo vai atrás de Suspense — a página renderiza primeiro, a IA "entra" depois.
5. **Sempre ter fallback sem IA.** Se a chave faltar ou a chamada falhar, a página continua funcional com uma versão determinística (regras simples), nunca quebra.
6. **Todo aviso propõe uma solução pronta pra executar, não só aponta o problema.** Decisão do usuário em 2026-06-30: "preciso que na medida do possível seja mais autônomo, ou seja, além de apontar o problema, propõe a solução e se autorizado executa." Na prática, hoje (sem API de envio de WhatsApp automatizado): a IA já monta a mensagem pronta e o link de ação (`wa.me` pré-preenchido, link pra `/recuperar`, etc.) — **o clique do dono é a autorização**, nada sai sozinho. Quando existir uma API de disparo real, subir um degrau: a IA dispara direto mas ainda pede confirmação prévia para ações de risco médio/alto (ver Hierarquia de decisões em [zulan-2.0-arquitetura-da-ia.md](zulan-2.0-arquitetura-da-ia.md)). Aplicado em: banner da Agenda (cliente atrasado → botão "Lembrar" com WhatsApp pronto; cancelamento/horário vazio → link direto pra `/recuperar`).
7. **Tom de funcionário falando com o dono, sempre.** Nunca "3 cancelamentos detectados" — sempre algo como "Um horário cancelou hoje e ficou livre. Posso te mostrar quem pode vir no lugar." Vale pra todo aviso novo, não só os gerados por LLM.
8. **Só decore demora que já é real.** Efeito de "digitando" (`TypewriterText`) e animações de entrada só fazem sentido onde já existe espera de verdade (resposta de LLM atrás de Suspense). Nunca adicionar esse tipo de encenação a um cálculo que já é instantâneo (ex.: banner da Agenda) — isso seria inventar lentidão pra parecer "mais IA", o que fere o princípio de performance. Sempre com cap de duração e respeitando `prefers-reduced-motion`.
