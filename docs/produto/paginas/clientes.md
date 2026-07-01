# Clientes

Rota: `/painel/[slug]/clientes` (lista) e `/painel/[slug]/clientes/[id]` (ficha)
Arquivo principal: `src/app/painel/[slug]/clientes/page.tsx` + `ClientsManager.tsx`; ficha em `clientes/[id]/page.tsx` + `ClientDetail.tsx`

## Objetivo

Cadastro e gestão da base de clientes do salão, incluindo ficha de anamnese/saúde, histórico de atendimentos e sinalização de clientes VIP ou parados.

## Funcionalidades

### Lista (`ClientsManager`)
- Busca por nome ou telefone.
- Filtro rápido "sem visita há": Todas / 30+ / 60+ / 90+ dias (calculado a partir da última visita via RPC `clients_overview`).
- Paginação client-side (30 por página).
- Selo VIP (calculado por `computeVipIds`) e selo de "alerta" (quando `clients.alert_summary` está preenchido) nos cards da lista.
- Cadastro de nova cliente (nome, celular, e-mail, nascimento, indicação) via modal.
- Remoção de cliente (com confirmação); se houver agendamentos vinculados, a exclusão é revertida no cliente (rollback otimista) e mostra erro.
- Atalho de WhatsApp por cliente com saudação pronta.

### Ficha (`ClientDetail`)
Três abas: Dados, Anamnese, Histórico.
- **Dados**: edição de nome, celular, e-mail, nascimento, indicação e observações livres.
- **Anamnese**: condições de saúde configuráveis por nicho do salão (`getAnamnesisConfig(niche)`), campos de texto (alergias, medicações, procedimentos recentes, notas de pele/cabelo, observações gerais) e termo de consentimento LGPD (nome de quem declarou + data de registro). Ao salvar, recalcula `alert_summary` do cliente (`computeAlertSummary`) a partir das condições marcadas.
- **Histórico**: até 50 últimos agendamentos (qualquer status), com data, profissional e valor.
- Cabeçalho da ficha mostra: resumo de valor (visitas, total gasto, ticket médio, última visita, faltas, cancelamentos, profissional favorito), selo VIP, selo de aniversário próximo (até 7 dias), atalho de WhatsApp, botão "Agendar" (leva para agenda com cliente pré-selecionado) e alerta de segurança (anamnese) sempre visível fora das abas quando existir.
- Bloco de sugestão de reativação: se o cliente está com atraso de retorno acima do ritmo normal (RPC `report_reactivation`), mostra card com dias sem vir / dias de atraso e botão para lembrar via WhatsApp.

## Permissões

- Lista: `canManage` = role `owner`, `manager` ou `receptionist` (calculado no server component, não via `getEffectivePermissions`). Controla exibição do botão "Nova cliente" e do botão de remover.
- Ficha: `canManage = perms.has("clients.manage")` (via `getEffectivePermissions`). Sem essa permissão, os campos de Dados e Anamnese ficam desabilitados (somente leitura) e os botões "Salvar" somem.

## Inteligência (IA)

Não há geração de texto por LLM nesta página. Há dois elementos de "narração" com o mesmo tom de voz do Gestor Zulan, mas calculados por regra direta sobre dados do banco (sem chamada a IA):
- Card de sugestão de reativação na ficha do cliente (RPC `report_reactivation`, guarda de amostra mínima de 14 dias de atraso).
- Selo VIP (top de gasto do salão, via `computeVipIds` sobre `clients_overview`).

## Dados / Backend

- Tabelas: `clients`, `client_anamnesis`, `appointments`, `salon_members` (join para nome do profissional).
- RPCs: `clients_overview`, `report_reactivation`.
- Helpers: `computeVipIds`, `nextBirthday` (`src/lib/clients.ts`), `getAnamnesisConfig`/`anamnesisToForm`/`computeAlertSummary` (`src/lib/anamnesis.ts`).
- `getMembershipBySlug`, `getEffectivePermissions`.

## Observações

- Ambas as páginas rodam com `export const dynamic = "force-dynamic"`.
- A configuração de anamnese varia conforme `salons.niche` (nicho do salão), então os campos exibidos na aba Anamnese não são fixos entre salões.
