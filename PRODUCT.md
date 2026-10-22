# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Donas e donos de pequenos negócios de beleza no Brasil — salões femininos, barbearias e estética — com peso igual entre salão e barbearia. Atendem na cadeira o dia todo, gerenciam pelo celular entre um cliente e outro e hoje marcam horário pelo WhatsApp, anotam comissão em caderno e fecham caixa na mão.

Público secundário: a cliente/o cliente final, que agenda pelo link público do salão (`/{slug}`) no celular, sem instalar nada.

## Product Purpose

Zulan é um sistema de gestão completa para salões e barbearias: agenda online com link público, confirmação e lembretes, cadastro de clientes, caixa, comissões, estoque, campanhas de recuperação de clientes e relatórios, com uma camada de IA ("equipe virtual") que trabalha enquanto o dono atende. Sucesso é o dono rodar o negócio inteiro num lugar só e faturar mais.

## Positioning

A promessa principal da landing é **gestão completa do salão num lugar só** — agenda, caixa, comissões, estoque e clientes — com a IA como diferencial que faz o sistema agir sozinho (recupera cliente sumido, confirma horário). Um sistema, dois mundos: tema, serviços e linguagem se ajustam ao nicho (salão feminino, barbearia, estética).

## Operating Context

- Dono configura o salão em minutos e compartilha o link de agendamento (WhatsApp, Instagram).
- Painel em `/painel/{slug}`; equipe com cargos (proprietária, gerente, profissional, recepção) e permissões por pessoa.
- Demonstração sem cadastro em `/demo/salao` e `/demo/barbearia`.
- Página dedicada para barbearia em `/barbearia`.
- PWA instalável; uso majoritário no celular.

## Capabilities and Constraints

- Planos (fonte: `src/lib/plans.ts`): Básico R$ 39,90 e Pro R$ 69,90. O Max (R$ 99,90) saiu da oferta em 2026-10-22 e não aparece mais em nenhuma tela.
- Sem fidelidade, cancela quando quiser; teste sem cartão.
- WhatsApp com número do próprio salão: comprovante, confirmação na véspera, agradecimento, avaliação, vaga liberada, "sentimos sua falta", retorno do serviço, aniversário e pacote vencendo (cada um liga/desliga em Configurações → WhatsApp).
- Nenhuma promessa de tempo de configuração ("2 minutos") — não foi medido.
- Stack: Next.js 16 + React 19 + Tailwind v4 + Supabase.

## Brand Commitments

- Nome **Zulan** e o logotipo atual (Z estilizado + "zulan") são obrigatórios.
- Todo o resto da identidade visual (cores, tipografia, fotos) pode ser repensado.
- Voz: português brasileiro direto, próximo, sem jargão técnico.
- Direção visual da landing: o padrão da categoria, executado com capricho (escolha do usuário em 2026-10-21, preferida às direções autorais). Régua de acabamento: Fresha e Booksy.

## Evidence on Hand

- Capturas reais do produto: `public/showcase-agenda.png`, `public/showcase-booking.png`.
- Fotos: `public/hero-zulan.jpg`, `public/hero-barbearia.jpg`, `public/ambiente-salao.jpg`, `public/ambiente-barbearia.jpg` (não são compromisso de marca).
- **Não há depoimentos, números de clientes, logos de clientes nem métricas de resultado.** Nada disso pode ser inventado.

## Product Principles

1. Salão e barbearia são cidadãos de primeira classe — nenhum dos dois é variação do outro.
2. Mostrar o produto real em vez de prometer: demonstração sem cadastro é a principal prova.
3. Gestão completa, explicada em linguagem de quem está na cadeira, não de software.
4. Honestidade comercial: nada de prova social inventada, recurso "em breve" sempre marcado.
