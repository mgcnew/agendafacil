# Billing — Assinatura via Asaas

Integração de assinatura recorrente por salão. Construído para começar no **Sandbox**.

## Planos (`src/lib/plans.ts`)

| Plano | Preço | Acesso |
|---|---|---|
| **Básico** | R$ 39,90 | Só agendamento: Agenda, Clientes, Serviços, Equipe, Horários |
| **Pro** | R$ 69,90 | Tudo (Caixa, Comissões, Estoque, Pacotes, Campanhas, Relatórios) |
| **Max** | R$ 99,90 | Tudo + WhatsApp — **"Em breve"**, não assinável até a integração existir |

Os módulos exclusivos do Pro (`PRO_ONLY_HREFS`) ficam **ocultos no menu** e **bloqueados por
URL** (guard `guardFeature`) quando o plano é Básico. No **trial**, o acesso é completo (Pro).

## Como funciona

- Cada salão tem uma linha em `salon_subscriptions` (criada automaticamente no cadastro),
  com a coluna `plan` (`basic`|`pro`|`max`).
- Status: `trialing` → `active` (pago) / `past_due` (venceu) / `canceled`.
- O painel libera o acesso se `active` **ou** (`trialing` e dentro do trial). Caso contrário,
  mostra a **tela de assinatura** (gate) no lugar do painel.
- "Assinar" cria cliente + assinatura no Asaas (valor = preço do plano escolhido) e redireciona
  para a página de pagamento hospedada (cliente escolhe PIX/boleto/cartão).
- O **webhook** do Asaas atualiza o status quando o pagamento é confirmado/vence. Pagamento
  confirmado grava `current_period_end` = vencimento + 1 mês (fim do dia em Brasília).
- **Cancelar** (botão no painel, só o dono) apaga a assinatura no Asaas — a cobrança para na hora —
  e marca `canceled`. O salão segue com acesso até `current_period_end` (função
  `salon_access_status`). Reassinar cria uma assinatura nova, com a 1ª cobrança no fim do período pago.
- **Estorno/contestação** cancelam no Asaas e cortam o acesso na hora.
- O webhook **recusa tudo** se `ASAAS_WEBHOOK_TOKEN` não estiver configurado.

## Variáveis de ambiente (`.env.local` e Vercel)

| Variável | O que é |
|---|---|
| `ASAAS_BASE_URL` | `https://api-sandbox.asaas.com/v3` (sandbox) ou `https://api.asaas.com/v3` (produção) |
| `ASAAS_API_KEY` | Chave de API do Asaas — Configurações → Integrações → Chave de API. **Secreta.** |
| `ASAAS_WEBHOOK_TOKEN` | Token que você inventa; o mesmo valor no Webhook do Asaas |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role`. **Secreta.** |

> As chaves secretas ficam **só no servidor**. Na Vercel, adicione em Project → Settings →
> Environment Variables (sem prefixo `NEXT_PUBLIC`).

## Configurar o Webhook no Asaas

1. Asaas → **Integrações → Webhooks → Adicionar**.
2. **URL**: `https://SEU-ENDERECO/api/asaas/webhook` (o `.vercel.app` serve — webhook não
   precisa de domínio próprio).
3. **Token de autenticação**: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.
4. Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`,
   `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_DELETED` e `SUBSCRIPTION_INACTIVATED`.

## Testar (Sandbox)

1. Preencha as 5 variáveis no `.env.local` e reinicie o `npm run dev`.
2. Logado como **dono** de um salão, vá em **Assinatura** → "Assinar agora" → deve abrir a
   página de pagamento do Asaas (sandbox).
3. Pague na sandbox (o Asaas tem cartões/PIX de teste) → o webhook chega e o status vira
   `active`. Confira em `salon_subscriptions`.
4. Para testar o **gate**: no banco, ponha `trial_ends_at` no passado e `status='trialing'`
   num salão de teste → o painel deve exibir a tela de assinatura.

## Lançamento — o que falta (auditoria de 2026-11-24)

O código de cobrança foi auditado e corrigido (commit `3a2498b`, no ar desde 24/11): cancelamento,
reassinatura, data do período pago e webhook. A migração
`20261124_acesso_ate_fim_do_periodo.sql` já está aplicada no banco. **A cobrança ainda não pode
ser ligada** — faltam os passos abaixo, nesta ordem.

Situação encontrada na auditoria:

- Nenhum salão jamais passou pelo checkout (zero `asaas_customer_id` no banco): o fluxo nunca
  rodou de ponta a ponta, nem no sandbox. Não há resto de teste para limpar.
- A chave de sandbox do `.env.local` está **inválida** (o Asaas responde `invalid_access_token`).
- Na Vercel, `ASAAS_BASE_URL` e `ASAAS_API_KEY` são do tipo *Sensitive* — o valor não pode ser
  lido, nem no painel. Tudo indica que ainda são do sandbox (criadas junto com a integração). Se
  for a mesma chave inválida, o botão "Assinar" falha hoje em produção.
- O webhook de produção (`/api/asaas/webhook`) está protegido: responde 401 sem token.
- `barbearia-pantanal` está `active` sem assinatura no Asaas (ativado à mão): não paga e não expira.

### Checklist

- [ ] **Chave nova de sandbox** — sandbox.asaas.com → Integrações → Chave de API. Colocar em
      `ASAAS_API_KEY` no `.env.local`.
- [ ] **Rodar o roteiro do sandbox** — `node scripts/asaas-sandbox-check.mjs .env.local`. Confere
      contra a API real: CPF inválido vira mensagem legível, cliente e assinatura são criados, o link
      é o da cobrança em aberto, a troca de plano muda o valor pendente, o pagamento confirma e o
      cancelamento não deixa nada em aberto.
- [ ] **Teste completo no app (sandbox)** — com o webhook do sandbox apontando para um endereço que
      receba (ex.: um deploy de preview), assinar com um salão de teste, pagar na página do Asaas e
      conferir em `salon_subscriptions`: `status = active` e `current_period_end` = vencimento + 1
      mês. Depois trocar de plano, cancelar (acesso continua até a data) e reassinar. **É a única
      parte ainda não testada:** o caminho do webhook que grava no banco com uma assinatura real.
- [ ] **Variáveis de produção na Vercel** — `ASAAS_BASE_URL=https://api.asaas.com/v3` e
      `ASAAS_API_KEY` com a chave `$aact_prod_…` da conta de produção. Redeploy em seguida
      (variável nova só vale em build novo).
- [ ] **Webhook na conta de produção do Asaas** — URL `https://zulan.com.br/api/asaas/webhook`,
      mesmo `ASAAS_WEBHOOK_TOKEN` da Vercel, com os eventos listados em "Configurar o Webhook".
- [ ] **Primeira cobrança real** — assinar o próprio salão com um valor real (ou cartão próprio),
      conferir o status no banco e estornar pelo Asaas: o salão deve ficar `canceled` na hora.
- [ ] **Decidir sobre `barbearia-pantanal`** — manter de cortesia ou pedir que assine.

## Ir para produção (depois)

1. Troque `ASAAS_BASE_URL` para `https://api.asaas.com/v3` e `ASAAS_API_KEY` pela chave de
   **produção**.
2. Recadastre o Webhook na conta de produção do Asaas.
3. O trial padrão é de 14 dias (`salon_subscriptions.trial_ends_at` default e o trigger
   `handle_new_salon_subscription`, desde a migração `20260717_trial_14_dias.sql`).
