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
- O **webhook** do Asaas atualiza o status quando o pagamento é confirmado/vence.

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
4. Eventos: marque ao menos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`.

## Testar (Sandbox)

1. Preencha as 5 variáveis no `.env.local` e reinicie o `npm run dev`.
2. Logado como **dono** de um salão, vá em **Assinatura** → "Assinar agora" → deve abrir a
   página de pagamento do Asaas (sandbox).
3. Pague na sandbox (o Asaas tem cartões/PIX de teste) → o webhook chega e o status vira
   `active`. Confira em `salon_subscriptions`.
4. Para testar o **gate**: no banco, ponha `trial_ends_at` no passado e `status='trialing'`
   num salão de teste → o painel deve exibir a tela de assinatura.

## Ir para produção (depois)

1. Troque `ASAAS_BASE_URL` para `https://api.asaas.com/v3` e `ASAAS_API_KEY` pela chave de
   **produção**.
2. Recadastre o Webhook na conta de produção do Asaas.
3. Ajuste o trial padrão se quiser (hoje 5 dias — em `salon_subscriptions.trial_ends_at`
   default e no backfill da migração).
