-- ─────────────────────────────────────────────────────────────────────────
-- Checklist "Primeiros passos" do dashboard: guarda quando o dono dispensou
-- ("Já conheço"). null = ainda mostrar. O checklist também some sozinho quando
-- todos os passos são detectados como concluídos (por dado real).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.salons add column onboarding_done_at timestamptz;
