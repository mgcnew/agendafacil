---
target: página pública de agendamento
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/marcelo/Documentos/agendafacil/src/app/[slug]/BookingApp.tsx"
target_fingerprint: "sha256:5847053bab439279d267700df8ddea6cc65338314e0283ec8b75302c2e8d45cb"
target_path: /home/marcelo/Documentos/agendafacil/src/app/[slug]/BookingApp.tsx
timestamp: 2026-11-24T20-03-36Z
slug: src-app-slug-bookingapp-tsx
---
Method: dual-agent (A: design review · B: detector + browser overlay)

## Design Health Score
| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | "Sem preferência" vira uma profissional na revisão sem aviso |
| 2 | Linguagem do mundo real | 3 | "Identifique-se" soa burocrático |
| 3 | Controle e liberdade | 2 | Voltar do celular sai da página; recarregar perde tudo |
| 4 | Consistência | 3 | Botão principal sai da barra fixa nas duas últimas etapas |
| 5 | Prevenção de erros | 3 | Dias fechados não aparecem marcados; avanço automático após toque |
| 6 | Reconhecer em vez de lembrar | 3 | Revisão não mostra nome e telefone |
| 7 | Flexibilidade e eficiência | 2 | Sem "primeiro horário livre" nem "repetir último" |
| 8 | Estética e minimalismo | 3 | Selo de desconto em todo serviço vira ruído |
| 9 | Recuperação de erros | 2 | "Ver próximo dia" pula para outro dia fechado |
| 10 | Ajuda | 2 | Sem pagamento, cancelamento, WhatsApp ou mapa no fluxo |
| Total | | 26/40 | Aceitável |

## Prioridades
- [P1] Sem histórico/persistência de etapas (BookingApp.tsx, step em useState; sem pushState/sessionStorage)
- [P1] Parede de horários: 89-92 botões/dia (15 min), dias fechados sem marcação
- [P1] Contraste do tema salão: branco/#f23c10 3,9:1 e #f23c10/#fffbf7 3,8:1 (CTA, preços, dia selecionado, banner) — detector e revisão concordam
- [P2] Revisão incompleta: sem dados do cliente, CTA quebra linha, Voltar inconsistente, falta "pagamento no salão"/cancelamento
- [P2] Final fraco: tela de sucesso sem calendário/mapa/WhatsApp, 💈 fixo para todo nicho (linha 1419), demo com dados de teste

## Detector
CLI: 0 achados (6 arquivos). Overlay em 6 estados: contraste do primário do salão (repetido), overused-font Plus Jakarta (heurística de gosto).
