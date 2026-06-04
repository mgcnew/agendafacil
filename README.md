# AgendeFácil 💇‍♀️💈

Sistema **multi-salão (SaaS)** de agendamento para salões de beleza, barbearias e estética.
Cada salão tem seu próprio link público, tema visual por nicho, equipe com permissões
granulares, comissões, caixa e estoque.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** com sistema de temas por nicho (tokens CSS)
- **Supabase** — Postgres, Auth, Row Level Security, RPC
- **PWA** — instalável, service worker, base para Web Push

## Funcionalidades

### Para a cliente (link público `/{slug}`)
- Tema visual condizente com o nicho do salão (feminino, barbearia, estética)
- Escolhe serviços → profissional → horário (disponibilidade real)
- Login por **telefone (OTP)**
- Histórico: vê os serviços que já fez ("Meus agendamentos")

### Para a dona / equipe (`/painel/{slug}`)
- **Visão geral** com indicadores do dia
- **Agenda** — ver por dia, mudar status, criar agendamento manual
- **Serviços** — CRUD com duração, preço e comissão
- **Equipe** — cargos (proprietária, gerente, profissional, recepção) e
  **permissões granulares por pessoa** (override do padrão do cargo)
- **Clientes** — cadastro e busca
- **Caixa & Comissões** — abertura/fechamento, entradas/saídas, comissões do mês
- **Estoque** — produtos, entrada/saída, alerta de estoque mínimo
- **Configurações** — dados, tema e o link de compartilhamento

## Arquitetura de permissões

- `salons` (tenant) → `salon_members` (vínculo usuário↔salão com cargo)
- `permissions` (catálogo) + `role_permissions` (padrão por cargo) +
  `member_permissions` (override por pessoa)
- Função `has_permission(salon, key)` resolve: **owner = tudo**, senão
  override do membro → padrão do cargo. Toda a segurança é aplicada via **RLS**
  no banco (o frontend apenas reflete o que o banco permite).

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
```

As variáveis já estão em `.env.local` (URL + chave publicável do Supabase).

## ⚙️ Configuração necessária no Supabase (para produção)

O código está pronto; estes ajustes são feitos no painel do Supabase:

1. **Login da dona/equipe (e-mail/senha)** — em *Authentication → Providers → Email*,
   desative "Confirm email" para testes rápidos, ou configure um SMTP para produção.
2. **Login da cliente (telefone/SMS)** — em *Authentication → Providers → Phone*,
   ative e configure um provedor de SMS (Twilio, MessageBird, etc.). Sem isso o
   código OTP não é enviado.
3. **Web Push (notificações no app)** — gere chaves VAPID e crie uma Edge Function
   para disparar os pushes a partir de `push_subscriptions`. O service worker já
   trata `push`/`notificationclick`.

## Migrações do banco

As migrações estão versionadas no Supabase (projeto `salao`):
`01_core_identity_and_tenancy` … `08_add_member_by_email`.
