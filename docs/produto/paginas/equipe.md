# Equipe

Rota: `/painel/[slug]/equipe`
Arquivo principal: `src/app/painel/[slug]/equipe/page.tsx` + `src/app/painel/[slug]/equipe/TeamManager.tsx`

## Objetivo

Gerenciar quem trabalha no salão: convidar, definir cargo/permissões, cadastro completo do profissional, quais serviços atende, comissão e pagamento de comissão.

## Funcionalidades

- Lista de membros do salão (cards com avatar, nome, cargo).
- Convites pendentes listados separadamente.
- Convidar novo membro (define e-mail, cargo e comissão) — ao criar, abre WhatsApp automaticamente com o link do convite pronto.
- Reenviar/compartilhar convite pendente via WhatsApp; cancelar convite pendente (com confirmação).
- Alterar cargo (role) de um membro diretamente na lista (indisponível para o próprio `owner`).
- Remover membro do salão (com confirmação); pode falhar se a pessoa tiver agendamentos vinculados.
- Editor de membro (modal com abas — abas variam se o membro é `owner` ou não):
  - **Dados**: nome de exibição, mini-bio, cor do avatar, foto (upload/troca/remoção, compressão client-side para ~512px JPEG).
  - **Cadastro** (não disponível para `owner`): tipo de vínculo (CLT/autônomo/aluguel de cadeira/freelancer/outro), valor e vencimento de aluguel de cadeira, CPF, RG, data de nascimento, telefone pessoal, endereço completo com autocompleta de CEP via ViaCEP, contrato assinado + data, observações internas.
  - **Serviços**: toggle de quais serviços o profissional atende, com comissão percentual específica opcional por serviço (exceção à comissão padrão).
  - **Finanças** (não disponível para `owner`; exige acesso ao plano de `/financeiro`): resumo do mês corrente (apurado/pago/a receber) e botão "Pagar" para registrar pagamento de comissão.
  - **Permissões** (não disponível para `owner`): toggle individual por permissão, sobrepondo o padrão do cargo.
- Gerar/baixar recibo de comissão em PDF (client-side, via jsPDF).

## Permissões

- `canManage = myRole === "owner" || myRole === "manager"`: controla botão "Convidar", ações sobre convites, troca de cargo na lista, botões "Editar" e "Remover" de cada membro.
- Se o membro sendo editado é `owner`, o modal só mostra as abas Dados e Serviços (esconde Cadastro, Finanças e Permissões).
- Aba **Finanças** também exige `canSeeFinance`, calculado no server via `planAllowsHref(access.effective_plan, "/financeiro")` — só planos Pro/Max.
- Checagem dupla no servidor (`actions.ts`): upload/remoção de foto exige `role === "owner" || "manager"` do usuário logado, independente do que o client já valida.
- As permissões editadas na aba Permissões são consumidas em outras páginas do painel (não controlam nada dentro da própria página Equipe).

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento.

## Dados / Backend

- Tabelas: `salon_members` (join `profiles`), `permissions`, `role_permissions`, `salon_invites`, `services`, `professional_services`, `salon_member_details`, `member_permissions`, `appointment_services` (join `appointments`), `package_redemptions`, `commission_payments`.
- Storage: bucket `logos`, path `avatars/{memberId}.jpg`.
- RPCs: `create_invite`, `revoke_invite`, `pay_commission`.

## Observações

- Regra de comissão em cascata (documentada na própria UI): comissão por serviço (exceção cadastrada em Serviços) > comissão padrão do serviço > comissão geral do profissional.
- Regime "aluguel de cadeira" zera a comissão automaticamente nos atendimentos/pacotes, independente da comissão configurada.
- Cálculo de "Finanças" no editor é só leitura do mês corrente, somando `appointment_services.commission_amount` (status `completed`) + `package_redemptions.commission_amount`, menos `commission_payments` do período; histórico mostra só os últimos 6 pagamentos.
- Recibo de PDF não tem valor fiscal (aviso explícito no documento gerado).
