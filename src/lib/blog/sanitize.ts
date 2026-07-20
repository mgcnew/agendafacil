/**
 * Limpeza de conteúdo do blog no cadastro.
 *
 * Motivo: é comum colar no campo Título o bloco inteiro de SEO gerado por IA
 * ("Título / Slug / Meta Description / Palavras-chave"), e isso já vazou pro
 * banco uma vez (título com 466 caracteres). Aqui a gente detecta esse bloco
 * e separa cada parte — e, na dúvida, corta a cauda de metadado do título.
 */

export type ParsedSeo = { title: string; slug?: string; excerpt?: string };

// Rótulos reconhecidos, cada um com o "campo" pro qual seu valor vai.
const LABEL_RE =
  /\b(t[íi]tulo|slug|meta\s+descri(?:ption|ção)|descri(?:ption|ção)|resumo|palavras[-\s]?chave|keywords|tags)\s*:/gi;

function fieldOf(label: string): "title" | "slug" | "excerpt" | "keywords" {
  const l = label.toLowerCase();
  if (/t[íi]tulo/.test(l)) return "title";
  if (l === "slug") return "slug";
  if (/descri|resumo/.test(l)) return "excerpt";
  return "keywords";
}

/**
 * Se `raw` parece o bloco de SEO (tem pelo menos um marcador forte de
 * metadado — slug/meta/palavras-chave), separa em título/slug/resumo.
 * Devolve null quando é um título normal (sem metadado).
 */
export function parsePastedSeo(raw: string): ParsedSeo | null {
  const text = (raw ?? "").replace(/\r/g, "").trim();
  if (!text) return null;

  const hits: { field: ReturnType<typeof fieldOf>; start: number; end: number }[] = [];
  for (const m of text.matchAll(LABEL_RE)) {
    hits.push({ field: fieldOf(m[1]), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }

  const strong = hits.some((h) => h.field === "slug" || h.field === "excerpt" || h.field === "keywords");
  if (!strong) return null;

  const out: ParsedSeo = { title: "" };

  // Texto antes do 1º rótulo = título (quando não vem um "Título:" explícito).
  const lead = text.slice(0, hits[0].start).trim();
  if (lead) out.title = lead;

  hits.forEach((h, i) => {
    const valEnd = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const val = text.slice(h.end, valEnd).trim().replace(/\s+/g, " ");
    if (!val) return;
    if (h.field === "title" && !out.title) out.title = val;
    else if (h.field === "slug" && !out.slug) out.slug = val;
    else if (h.field === "excerpt" && !out.excerpt) out.excerpt = val;
    // keywords: sem campo correspondente, ignorado.
  });

  return out.title ? out : null;
}

/**
 * Rede de segurança: tira do título qualquer cauda de metadado (a partir do
 * primeiro rótulo forte) e um prefixo "Título:" solto. Idempotente em títulos
 * já limpos.
 */
export function stripSeoTail(s: string): string {
  return (s ?? "")
    .replace(/\s*\b(?:slug|meta\s+descri(?:ption|ção)|descri(?:ption|ção)|palavras[-\s]?chave|keywords|tags)\s*:[\s\S]*$/i, "")
    .replace(/^\s*t[íi]tulo\s*:\s*/i, "")
    .trim();
}
