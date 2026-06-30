# ZULAN 2.0 — Documentação de Produto

Conjunto de documentos que define a direção estratégica do produto. Toda decisão de produto, design e desenvolvimento deve respeitar o que está descrito aqui.

| Documento | Resumo |
|---|---|
| [zulan-2.0-biblia-do-produto.md](zulan-2.0-biblia-do-produto.md) | Missão, visão, propósito e os 7 princípios do produto |
| [zulan-2.0-arquitetura-da-ia.md](zulan-2.0-arquitetura-da-ia.md) | Como a IA pensa (observar → analisar → decidir → agir) e os 5 pilares |
| [zulan-2.0-equipe-virtual-inteligente.md](zulan-2.0-equipe-virtual-inteligente.md) | Organograma da equipe virtual coordenada pelo Gestor IA |
| [zulan-2.0-estrategia-comercial.md](zulan-2.0-estrategia-comercial.md) | Planos (Solo / Equipe / Gestor) e como comunicar valor |
| [zulan-2.0-manifesto-equipe-virtual.md](zulan-2.0-manifesto-equipe-virtual.md) | Texto de posicionamento — o problema, a visão, a promessa |
| [zulan-2.0-documento-funcional-das-paginas.md](zulan-2.0-documento-funcional-das-paginas.md) | Página por página: situação atual vs. evolução com IA |

---

## Resumo executivo

**A virada de posicionamento:** o Zulan deixa de ser vendido como "sistema de agendamento com IA" e passa a ser vendido como **equipe virtual** — um conjunto de colaboradores especializados (Recepção, Marketing, Financeiro, Relacionamento, Operações, Coach), coordenados por um **Gestor IA**, que trabalham continuamente pelo salão.

**Regra de ouro (vale para toda funcionalidade e toda tela):** uma ação ou página só se justifica se responder "sim" a pelo menos uma destas perguntas — aumenta faturamento? economiza tempo? melhora a experiência do cliente? Se não, deve ser repensada.

**Ciclo de funcionamento da IA:** Observar → Analisar → Decidir → Agir. A IA deve agir proativamente em ações de baixo risco (lembretes, confirmações, aniversários) e pedir autorização em ações de maior impacto (descontos, preços, cancelamentos, financeiro, campanhas em massa).

**Tom de voz:** nunca linguagem técnica ("detectei queda de frequência"); sempre conversa natural ("percebi que alguns clientes sumiram, posso preparar uma campanha para trazê-los de volta").

**Estrutura comercial:** os planos passam a ser apresentados como "contratação de colaboradores" (Solo = Recepcionista; Equipe = + Marketing + Relacionamento; Gestor = + Financeiro + Operações + Coach + Gestor IA), não como tiers de funcionalidades.

**Mapeamento por página (do doc funcional):**
- **Dashboard** → resumo diário do Gestor IA com oportunidades priorizadas, não números soltos
- **Agenda** → identifica vazios, sugere encaixes, remarca, preenche horários fracos
- **Clientes** → histórico inteligente (frequência, ticket médio, risco de abandono)
- **Recuperação de clientes** → já existe (`/recuperar`) e é o protótipo do que as outras páginas devem virar
- **Estoque** → preditivo: alerta reposição, identifica desperdício, calcula lucro real
- **Financeiro → "Inteligência do Negócio"** → renomear e reorganizar em abas (Financeiro / Inteligência / Temperatura / Crescimento / Assistente IA)
- **Equipe** → painel por colaborador com indicadores e sugestões de metas/treinamento
- **Campanhas** → IA escolhe público, horário e texto automaticamente

## O que isso implica para o roadmap técnico

Esses documentos são visão de produto, não uma spec de implementação. Antes de tocar em código, vale decidir com você:
1. Qual painel/feature começa primeiro (Dashboard com resumo do Gestor IA parece o ponto de entrada mais natural, já que toca todas as outras áreas).
2. Que modelo de IA/orquestração vai gerar essas análises (regras determinísticas hoje vs. LLM).
3. Escopo realista para uma primeira versão visível ao usuário, dado que "Recuperar clientes" já é um protótipo funcionando desse padrão.
