-- ─────────────────────────────────────────────────────────────────────────
-- Fix: o botão "Atualizar" do Gestor Zulan não conseguia sobrescrever o cache.
--
-- A tabela ai_dashboard_insights só tinha policy de SELECT e INSERT. O refresh
-- usa upsert (ON CONFLICT DO UPDATE) na mesma linha (salon_id, date), o que é
-- um UPDATE — sem policy de UPDATE, a RLS bloqueava a gravação e o resumo
-- antigo do dia ficava preso no cache. Esta policy libera o membro do salão a
-- atualizar o próprio resumo.
-- ─────────────────────────────────────────────────────────────────────────

create policy "ai_dashboard_insights_member_update" on public.ai_dashboard_insights
  for update
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  )
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid()
    )
  );
