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

- Card "Gestor Zulan" no topo da Visão geral, narra (não calcula) sinais já existentes: clientes pra reativar, aniversariantes, pacotes vencendo, faturamento do dia.
- IA: DeepSeek via tool calling (schema fixo), cache de 1x/dia por salão (`ai_dashboard_insights`), fallback determinístico sem IA.
- UX: streaming via Suspense (não bloqueia o resto da página), botão de atualizar manual (Server Action, ignora cache do dia).
- Arquivos: `src/lib/ai/dashboardInsights.ts`, `src/lib/ai/deepseek.ts`, `src/app/painel/[slug]/GestorInsights.tsx`, `RefreshGestorButton.tsx`, `gestorActions.ts`.

**Não incluído de propósito:** insight de "receita do dia" no modo stub (só no modo live); ação autônoma (a IA só narra e linka, nunca dispara mensagem sozinha).

---

## Agenda

**Status: 🔜 Planejado (v1)**

### v1 — sinais fáceis, sem RPC nova (próxima fase)
Dados já calculáveis a partir do que a página já carrega (sem agregação histórica):
- Cancelamentos no período visível
- Clientes atrasados (`starts_at` passado, status ainda `pending`/`confirmed`)
- Horários vazios de hoje (cruzando agendamentos do dia com a RPC `get_availability`, que já existe)

Formato: banner acima do calendário, no mesmo espírito do card do Dashboard — mas aqui pode ser regra direta (sem LLM), já que são contagens simples, não precisa de narrativa gerada.

### v2 — adiado, motivo registrado (2026-06-30)
Avaliado e **conscientemente adiado**, não esquecido:

| Sinal | Por que não entra na v1 |
|---|---|
| Horários mais lucrativos | Precisa de RPC nova agregando receita histórica por faixa de horário (não é cálculo do que já está na tela) |
| Dias fracos | Precisa de RPC nova comparando ocupação média por dia da semana ao longo do tempo |
| Oportunidades de encaixe | Precisa cruzar gap livre + duração de serviço + lista de clientes parados (`/recuperar`) — acopla dois módulos hoje independentes |

**Bloqueador real da v2:** problema de amostra mínima. Salão novo/com pouco histórico não tem padrão suficiente pra esses cálculos serem confiáveis — sem um guard (ex.: "só mostra dia fraco com 8+ semanas de dados"), o risco é apontar tendência falsa a partir de 2-3 pontos, o que é pior que não mostrar nada. Reavaliar quando tivermos salões com uso real e histórico suficiente pra validar.

**Ações inteligentes (remarcar cliente, preencher horário sozinho, abrir horário extra) — fora de escopo até existir um fluxo de aprovação.** Isso é ação autônoma de risco médio/alto pela hierarquia de decisões definida em [zulan-2.0-arquitetura-da-ia.md](zulan-2.0-arquitetura-da-ia.md); não deve ser construído sem esse fluxo existir primeiro.

---

## Clientes

**Status: ⬜ Não avaliado**

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
2. **Sem ação autônoma sem fluxo de aprovação.** Enquanto não existir um mecanismo de confirmação, a IA só sugere e linka — nunca dispara mensagem, desconto ou remarcação sozinha.
3. **Cuidado com amostra pequena.** Qualquer insight baseado em histórico/tendência precisa de um piso mínimo de dados antes de aparecer — testado na prática com o Dashboard (salão de teste com 2 clientes não gerava nenhum insight até popularmos dados de seed).
4. **Streaming, nunca bloquear a página.** Chamada a LLM externo vai atrás de Suspense — a página renderiza primeiro, a IA "entra" depois.
5. **Sempre ter fallback sem IA.** Se a chave faltar ou a chamada falhar, a página continua funcional com uma versão determinística (regras simples), nunca quebra.
