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

**Status: ✅ Implementado** (anterior ao reposicionamento Zulan 2.0)

- `/recuperar`: tabs no_shows / cancelled / inactive, busca por nome, ajuste de período, RPC `marketing_winback`, WhatsApp 1-clique com cupom opcional.
- Foi o protótipo que inspirou o padrão "narrar dados confiáveis" usado depois no Dashboard.

---

## Estoque

**Status: ⬜ Não avaliado**

---

## Inteligência do Negócio (Financeiro)

**Status: ⬜ Não avaliado**

---

## Equipe

**Status: ⬜ Não avaliado**

---

## Campanhas

**Status: ⬜ Não avaliado**

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
