/**
 * Tema para o que abre em portal (modal, menu, calendário).
 *
 * O portal vai para o <body>, fora do wrapper do painel. Copiar só
 * data-niche/data-color trazia de volta o tema inteiro do salão (fonte de
 * nicho, fundo tingido), porque a base Zulan mora na classe `.panel-root`.
 * Aqui copiamos também essa classe e a variável da fonte, quando o
 * ancestral as tem; fora do painel (página pública) nada muda.
 */
export type PortalTheme = { niche?: string; color?: string; className?: string };

export function portalThemeOf(host: Element | null | undefined): PortalTheme {
  if (!host) return {};
  const classes = Array.from(host.classList).filter(
    (c) => c === "panel-root" || c.endsWith("__variable"),
  );
  return {
    niche: host.getAttribute("data-niche") ?? undefined,
    color: host.getAttribute("data-color") ?? undefined,
    className: classes.length ? classes.join(" ") : undefined,
  };
}
