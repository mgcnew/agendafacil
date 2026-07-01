# Pacotes

Rota: `/painel/[slug]/pacotes`
Arquivo principal: `src/app/painel/[slug]/pacotes/page.tsx` + `PackagesManager.tsx`

## Objetivo

Vender e controlar pacotes de sessões pré-pagas (ex.: "4 manicures") por cliente: criação de modelos, venda, uso (resgate) de sessões e acompanhamento de vencimento.

## Funcionalidades

Duas abas: "Vendidos" e "Modelos".

- **Modelos** (`TemplatesList`/`TemplateEditor`): criação/edição de modelo de pacote — nome, validade em dias, preço, lista de serviços incluídos com quantidade cada. Ao editar, mostra um painel "Pra te ajudar a decidir o preço" com preço avulso somado, desconto efetivo do pacote e lucro estimado (preço do pacote menos comissão estimada) — cálculo ao vivo enquanto o usuário edita.
- **Vendidos** (`SoldList`): lista pacotes já vendidos por cliente, com status (Ativo/Concluído/Expirado/Cancelado — expiração calculada em tempo real comparando `expires_at`), progresso de uso por item (`used`/`total`) e botão "Usar" (resgatar 1 sessão de um item do pacote).
- Venda de novo pacote (`SellModal`): escolhe cliente e modelo, confirma venda — entra como receita no caixa (se aberto).
- Resgate de sessão (`RedeemModal`): registra uso de uma sessão do pacote, atribuindo opcionalmente o profissional que atendeu (para gerar comissão), via RPC `redeem_package`.
- Banner "De olho nos pacotes" na aba Vendidos — ver seção Inteligência.

## Permissões

- Acesso à página inteira: `perms.has("packages.view")`; sem essa permissão, redireciona para o dashboard.
- `canManage = perms.has("packages.manage")` — controla exibição dos botões "Vender pacote", "Novo modelo", edição/exclusão de modelos e ação "Usar" sessão.
- Página também passa por `guardFeature(slug, "/pacotes")` — checagem de acesso por plano de assinatura do salão.

## Inteligência (IA)

Não há LLM. Há dois blocos de "narração" com o mesmo padrão visual/tom do Gestor Zulan, mas calculados por regra direta sobre os dados já carregados (sem chamada a IA), explicitamente descritos no código como "cálculo direto, sem IA":

- Banner "De olho nos pacotes" (aba Vendidos):
  - Pacotes "parados": comprados, zero sessão usada, há 14+ dias desde a compra (`DORMANT_DAYS`) — com botão de lembrete via WhatsApp por cliente.
  - Pacotes vencendo em até 7 dias — contagem consolidada.
  - Banner some por completo se não houver pacotes parados nem vencendo.
- Painel "Pra te ajudar a decidir o preço" no editor de modelo: preço avulso somado dos serviços escolhidos, desconto efetivo do pacote e lucro estimado. A comissão usada é a média real (via `service_insights`, reaproveitada da página Serviços) quando há histórico do serviço, senão cai para o percentual de comissão cadastrado.

## Dados / Backend

- Tabelas: `package_templates`, `package_template_items`, `client_packages`, `client_package_items`, `services`, `clients`, `salon_members`.
- RPCs: `redeem_package`, `service_insights` (reaproveitada de Serviços).
- `getMembershipBySlug`, `getEffectivePermissions`, `guardFeature`.

## Observações

- Página roda com `export const dynamic = "force-dynamic"`.
- Lista de "Vendidos" é limitada aos últimos 100 registros (`.limit(100)`).
