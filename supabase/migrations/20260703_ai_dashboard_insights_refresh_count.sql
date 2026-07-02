-- ─────────────────────────────────────────────────────────────────────────
-- Limite de análises manuais/dia do Gestor Zulan (botão "Analisar de novo"):
-- cada linha já é por (salon_id, date), então o contador reseta sozinho
-- à meia-noite — só precisamos guardar quantas vezes o dono pediu hoje.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.ai_dashboard_insights
  add column refresh_count integer not null default 0;
