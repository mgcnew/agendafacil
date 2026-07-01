# Configurações

Rota: `/painel/[slug]/configuracoes`
Arquivo principal: `src/app/painel/[slug]/configuracoes/page.tsx`, `src/app/painel/[slug]/configuracoes/SettingsTabs.tsx`

## Objetivo

Central de configuração do salão: dados cadastrais, horários, regras de agendamento, caixa, permissões por cargo, aparência do link público e assinatura — tudo em abas dentro de uma única página.

## Funcionalidades

- Aba **Estabelecimento**: editar nome, segmento (niche), e-mail, telefone, endereço e nome de exibição do dono; upload/remoção de logo (comprimida no navegador para WebP antes do envio, limite de 15 MB no cliente / 3 MB no servidor); edição do link de agendamento (slug), com verificação de unicidade e aviso de que o link antigo para de funcionar.
- Aba **Horários**: reaproveita o componente `HoursManager` da página Horários (embutido, `embedded`).
- Aba **Agendamento**: exibe/copia o link público de agendamento; toggle para permitir atendimentos simultâneos da mesma cliente com profissionais diferentes.
- Aba **Caixa**: habilita/desabilita desconto no caixa e define o percentual máximo de desconto permitido.
- Aba **Acessos**: matriz de permissões por cargo (Gerente, Profissional, Recepção) — toggle por permissão, agrupado por categoria; grava overrides em `salon_role_permissions` por salão (sobre os defaults globais em `role_permissions`). Exceções por pessoa ficam na página Equipe, fora desta página.
- Aba **Aparência**: escolha da paleta de cores do salão entre grupos pré-definidos ou "padrão do segmento" (tipografia é definida pelo segmento, cor é livre).
- Aba **Assinatura**: renderiza o mesmo `SubscribePanel` usado na antiga página `/assinatura` (ver `assinatura.md`) — assinatura passou a viver como aba aqui.
- Cada aba tem salvamento próprio com feedback de "Salvo!" e tratamento de erro.

## Permissões

- Acesso à página exige pelo menos uma de: `salon.manage`, `schedule.manage` ou `team.manage`; sem nenhuma, redireciona para o painel.
- As abas visíveis variam por permissão: Horários exige `schedule.manage`; Acessos exige `team.manage`; as demais (Estabelecimento, Agendamento, Caixa, Aparência, Assinatura) exigem `salon.manage`.
- Edição de campos do Estabelecimento/Agendamento/Caixa/Aparência (`canEdit`) é restrita a `membership.role === "owner"` — quem tem só `salon.manage` por permissão de cargo visualiza mas não edita esses campos.
- Upload/remoção de logo (`actions.ts`) reforça no servidor que apenas o dono (`salon.owner_id === uid`) pode alterar.

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento.

## Dados / Backend

- Tabelas: `salons`, `salon_members`, `working_hours`, `permissions`, `role_permissions`, `salon_role_permissions`.
- RPC: `salon_access_status` (via `getAccessStatus`, para a aba Assinatura).
- Storage: bucket `logos` (upload/remoção via `createAdminClient`, contornando RLS no servidor).

## Observações

A rota `/painel/[slug]/assinatura` foi descontinuada como página própria e agora apenas redireciona para `/painel/[slug]/configuracoes?tab=assinatura` (ver `assinatura.md`).
