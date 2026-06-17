# Configurar e-mail de produção (SMTP próprio via Resend)

> **Por quê:** o SMTP padrão do Supabase limita a ~3–4 e-mails/hora (compartilhado entre
> todos os projetos) e cai em spam. Em produção, cadastro e reset de senha falham. Esta
> config troca por um remetente próprio com limite de 3.000 e-mails/mês (plano grátis).

Projeto Supabase de produção: **`salao-br`** (`lllibsgqpvgmpurzmram`, região São Paulo).

---

## Pré-requisito: um domínio próprio

Você precisa de um domínio (ex.: `agendefacil.com.br`) onde consiga editar registros DNS.
O Resend exige verificar o domínio antes de enviar para clientes — sem domínio, ele só
envia e-mail de teste para o seu próprio endereço.

---

## Passo 1 — Criar conta e domínio no Resend

1. Crie conta em https://resend.com (grátis).
2. Em **Domains → Add Domain**, informe seu domínio (ex.: `agendefacil.com.br`).
3. O Resend mostra 3 registros DNS para adicionar no painel do seu domínio (registrador
   ou Cloudflare):
   - 1× **MX** (ou TXT, dependendo) para o subdomínio de envio
   - 2× **TXT** — DKIM (assinatura) e SPF
   - (opcional, recomendado) 1× **TXT** para DMARC
4. Adicione os registros no DNS e clique em **Verify**. Pode levar de minutos a algumas
   horas para propagar. Aguarde ficar **Verified** (verde).

## Passo 2 — Gerar a chave / credenciais SMTP no Resend

No Resend, vá em **API Keys → Create API Key** (permissão "Sending access").
Para uso como SMTP, os dados são:

| Campo            | Valor                                  |
|------------------|----------------------------------------|
| Host             | `smtp.resend.com`                      |
| Porta            | `465` (SSL) ou `587` (TLS)             |
| Usuário          | `resend`                               |
| Senha            | a **API Key** gerada (`re_...`)        |

## Passo 3 — Ligar o SMTP no Supabase

Supabase → projeto **salao-br** → **Authentication → Settings → SMTP Settings**:

1. Ative **Enable Custom SMTP**.
2. Preencha:
   - **Sender email**: `nao-responda@SEU-DOMINIO` (ex.: `nao-responda@agendefacil.com.br`)
   - **Sender name**: `AgendeFácil`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: a API Key (`re_...`)
3. Salve.

> O **Sender email** precisa usar o domínio verificado no Passo 1, senão o Resend rejeita.

## Passo 4 — Aplicar os templates em português

Em **Authentication → Email Templates**, para cada tipo, cole o HTML correspondente
(aba "Source"/"Message body") e ajuste o assunto:

| Template no Supabase | Arquivo                | Assunto sugerido                       |
|----------------------|------------------------|----------------------------------------|
| Confirm signup       | `confirm-signup.html`  | Confirme seu e-mail — AgendeFácil      |
| Reset password       | `reset-password.html`  | Redefinir sua senha — AgendeFácil      |

## Passo 5 — Ajustar limites e URLs

1. **Authentication → Rate Limits**: com SMTP próprio você pode subir o limite de e-mails
   por hora (o padrão baixo existia por causa do SMTP compartilhado).
2. **Authentication → URL Configuration → Site URL / Redirect URLs**: confirme que apontam
   para o domínio de produção (ex.: `https://SEU-DOMINIO`), senão os links dos e-mails
   levam para o lugar errado.

## Passo 6 — Testar de verdade

1. Faça um cadastro novo com um e-mail real (de outro provedor, ex.: Gmail) → deve chegar
   o "Confirme seu e-mail" na **caixa de entrada** (não no spam).
2. Faça "Esqueci minha senha" → deve chegar o e-mail de reset.
3. No Resend → **Logs**, confirme os envios com status `delivered`.

---

### Resumo do que falta de você
- [ ] Ter um domínio próprio
- [ ] Conta no Resend + domínio verificado (DNS)
- [ ] Colar credenciais SMTP no Supabase (Passo 3)
- [ ] Conferir Site URL / Redirect URLs (Passo 5.2)
