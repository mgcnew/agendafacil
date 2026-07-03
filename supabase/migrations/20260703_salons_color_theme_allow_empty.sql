-- ─────────────────────────────────────────────────────────────────────────
-- Permite color_theme = '' (string vazia) = "padrão nativo do segmento".
--
-- O painel usa '' como sentinela oficial de identidade nativa (barbearia sem
-- data-color; ver layout.tsx). Mas a CHECK só aceitava 'a'..'l', então salvar
-- o tema "Padrão" numa barbearia dava "Não foi possível salvar". A coluna
-- segue NOT NULL default 'a'; só passamos a aceitar '' como valor válido.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.salons drop constraint salons_color_theme_check;

alter table public.salons add constraint salons_color_theme_check
  check (color_theme = any (array['', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']));
