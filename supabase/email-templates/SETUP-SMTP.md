# Configurar e-mail de produção (SMTP próprio via Resend)

> **Por quê:** o SMTP padrão do Supabase é feito para testes — limite baixo de envios por
> hora (compartilhado entre todos os projetos), remetente genérico e alta chance de cair em
> spam. Em produção, cadastro e reset de senha simplesmente falham. Com remetente próprio o
> e-mail sai como **Zulan &lt;nao-responda@zulan.com.br&gt;** e o plano grátis do Resend cobre
> 3.000 e-mails/mês.

Projeto Supabase de produção: **`salao-br`** (`lllibsgqpvgmpurzmram`, região São Paulo).
Domínio: **zulan.com.br** (registrado na Hostinger, DNS gerenciado lá).

---

## Passo 1 — Criar conta e domínio no Resend

1. Crie conta em https://resend.com (grátis).
2. Em **Domains → Add Domain**, informe `zulan.com.br`.
3. O Resend mostra os registros DNS a adicionar. Normalmente:
   - 1× **MX** para o subdomínio de envio (ex.: `send.zulan.com.br`)
   - 2× **TXT** — DKIM (assinatura) e SPF
   - (recomendado) 1× **TXT** de DMARC
4. Adicione os registros na **Hostinger** → Domínios → zulan.com.br → Gerenciar registros DNS.
5. Clique em **Verify** no Resend e aguarde ficar **Verified** (verde). Pode levar de
   minutos a algumas horas.

> ⚠️ Não mexa nos registros que já existem para o site: o `A @` (Vercel), o `CNAME www`
> (Vercel) e o `A wa` (Evolution). Os do Resend são adicionais e não conflitam.

## Passo 2 — Gerar as credenciais SMTP no Resend

Em **API Keys → Create API Key**, permissão "Sending access". Os dados de SMTP são:

| Campo   | Valor                            |
|---------|----------------------------------|
| Host    | `smtp.resend.com`                |
| Porta   | `465` (SSL) ou `587` (TLS)       |
| Usuário | `resend`                         |
| Senha   | a **API Key** gerada (`re_...`)  |

## Passo 3 — Ligar o SMTP no Supabase

Supabase → projeto **salao-br** → **Authentication → Settings → SMTP Settings**:

1. Ative **Enable Custom SMTP**.
2. Preencha:
   - **Sender email**: `nao-responda@zulan.com.br`
   - **Sender name**: `Zulan`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: a API Key (`re_...`)
3. Salve.

> O **Sender email** precisa usar o domínio verificado no Passo 1, senão o Resend rejeita.

## Passo 4 — Aplicar os templates em português

Em **Authentication → Email Templates**, para cada tipo, cole o HTML correspondente
(aba "Source"/"Message body") e ajuste o assunto:

| Template no Supabase | Arquivo               | Assunto sugerido                 |
|----------------------|-----------------------|----------------------------------|
| Confirm signup       | `confirm-signup.html` | Confirme seu e-mail — Zulan      |
| Reset password       | `reset-password.html` | Redefinir sua senha — Zulan      |

> O "Confirm signup" atende **dono de salão e funcionário convidado**: o aceite de convite
> usa `signUp` com `emailRedirectTo`, então cai nesse mesmo template.

## Passo 5 — Ajustar limites e URLs

1. **Authentication → Rate Limits**: com SMTP próprio dá para subir o limite de e-mails por
   hora (o padrão baixo existia por causa do SMTP compartilhado).
2. **Authentication → URL Configuration**: `Site URL` e `Redirect URLs` devem apontar para
   `https://zulan.com.br`, senão os links dos e-mails levam para o lugar errado.
3. **Authentication → Providers → Email**: religar **Confirm email**, que está desligado
   desde os testes. Só faz sentido religar depois que o SMTP estiver funcionando.

## Passo 6 — Testar de verdade

1. Cadastro novo com e-mail real de outro provedor (Gmail) → o "Confirme seu e-mail" tem
   que chegar na **caixa de entrada**, não no spam.
2. "Esqueci minha senha" → deve chegar o e-mail de reset.
3. Resend → **Logs**: confirme os envios com status `delivered`.
4. Abra um dos e-mails **no celular** — a maioria dos donos de salão lê por lá.

---

### Resumo do que falta
- [x] Domínio próprio (`zulan.com.br`)
- [ ] Conta no Resend + domínio verificado (Passo 1)
- [ ] Credenciais SMTP no Supabase (Passo 3)
- [ ] Templates colados (Passo 4)
- [ ] Religar "Confirm email" (Passo 5.3)
