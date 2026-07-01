# Horários

Rota: `/painel/[slug]/horarios` (redireciona para `/painel/[slug]/configuracoes?tab=horarios`)
Arquivo principal: `src/app/painel/[slug]/horarios/page.tsx` (redirect) + `src/app/painel/[slug]/horarios/HoursManager.tsx` (renderizado embutido dentro de `configuracoes/SettingsTabs.tsx`)

## Objetivo

Definir o expediente padrão do salão e, opcionalmente, horários próprios por profissional, para controlar quando cada um pode ser agendado.

## Funcionalidades

- Não existe mais como página própria: a rota `/horarios` só redireciona para a aba "Horários" dentro de Configurações (`SettingsTabs.tsx` importa e renderiza `HoursManager` com `embedded`, escondendo cabeçalho próprio).
- Seletor "Editando": salão (padrão) ou um profissional específico — sem horário próprio configurado, o profissional usa o padrão do salão.
- Para cada dia da semana: liga/desliga (fechado ou aberto), horário de início e fim quando aberto.
- Botão "copiar" por dia: replica o horário daquele dia para todos os outros dias já ativos.
- Validação antes de salvar: início precisa ser antes do fim para todos os dias ativos, com mensagem listando os dias inválidos.
- Salvar: substitui (delete + insert) as linhas de `working_hours` do alvo selecionado (salão ou profissional); se a inserção falhar após o delete, tenta restaurar automaticamente o estado anterior para não deixar o profissional sem nenhum horário configurado.

## Permissões

Acesso à aba "Horários" dentro de Configurações é controlado por `perms.has("schedule.manage")` (`canManageSchedule`, calculado em `configuracoes/page.tsx`) — sem essa permissão, a aba não aparece na navegação de Configurações. Não há checagem de permissão adicional dentro do próprio `HoursManager.tsx`.

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento.

## Dados / Backend

- Tabela `working_hours` (colunas relevantes: `salon_id`, `member_id` — `null` para o padrão do salão —, `weekday`, `start_time`, `end_time`).
- Lista de profissionais (`pros`) e horários iniciais (`initialHours`) são carregados no server em `configuracoes/page.tsx` e repassados como props.

## Observações

- A rota antiga `/painel/[slug]/horarios` foi mantida apenas como redirect para não quebrar links/favoritos salvos; a funcionalidade real vive hoje dentro de Configurações.
- `HoursManager.tsx` é compartilhado entre a rota antiga (se algum dia voltar a ser standalone, via prop `embedded=false`) e o uso atual embutido em Configurações (`embedded=true`).
