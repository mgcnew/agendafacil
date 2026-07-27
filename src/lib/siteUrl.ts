/**
 * URL pública do site, em um lugar só.
 *
 * Antes cada arquivo repetia `process.env.NEXT_PUBLIC_SITE_URL ?? "..."`. O
 * problema: `??` só cai no fallback com null/undefined — string VAZIA passa
 * direto. Uma variável criada sem valor na Vercel virava `new URL("")` no
 * metadataBase e derrubava o build inteiro com ERR_INVALID_URL.
 *
 * Aqui a variável só é aceita se realmente tiver conteúdo, e a barra final é
 * removida pra montar link por concatenação sem gerar `//`.
 *
 * Precisa ser NEXT_PUBLIC_ porque o link do salão também é montado no
 * navegador — e o valor é embutido no build, então mudar a variável exige
 * um redeploy.
 */
const RAW = process.env.NEXT_PUBLIC_SITE_URL;

const FALLBACK = "https://zulan.com.br";

function resolve(): string {
  const value = typeof RAW === "string" ? RAW.trim() : "";
  if (!value) return FALLBACK;

  // Vazio, "undefined" literal ou URL malformada não podem quebrar o build.
  try {
    return new URL(value).origin;
  } catch {
    return FALLBACK;
  }
}

export const SITE_URL = resolve();
