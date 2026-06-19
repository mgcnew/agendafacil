-- ─────────────────────────────────────────────────────────────────────────
-- Bloqueio de agenda pela própria profissional
--
-- Até aqui só quem tinha 'schedule.manage' (dono/gerente) podia mexer em
-- schedule_blocks (policy sb_write). Agora qualquer membro do salão pode
-- criar/remover bloqueios DA SUA PRÓPRIA agenda (member_id = ele mesmo),
-- sem precisar gerenciar a escala do salão inteiro.
--
-- Bloqueios para "todos" (member_id null) ou para outra pessoa continuam
-- restritos a quem tem 'schedule.manage'. As policies são permissivas (OR),
-- então sb_write (gestão) + sb_write_self (próprio) coexistem.
-- ─────────────────────────────────────────────────────────────────────────

create policy "sb_write_self" on public.schedule_blocks
  for all
  using (
    member_id is not null
    and member_id in (
      select sm.id from public.salon_members sm
      where sm.salon_id = schedule_blocks.salon_id and sm.profile_id = auth.uid()
    )
  )
  with check (
    member_id is not null
    and member_id in (
      select sm.id from public.salon_members sm
      where sm.salon_id = schedule_blocks.salon_id and sm.profile_id = auth.uid()
    )
  );
