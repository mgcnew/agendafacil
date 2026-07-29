/**
 * Redes sociais do salão — normalização do que o dono digita.
 *
 * O erro mais comum não é o dono deixar em branco: é ele colar `@barbearia`,
 * `instagram.com/barbearia`, ou o link inteiro com `?igsh=...` do botão de
 * compartilhar. Guardar isso cru e jogar num `href` gera link quebrado na
 * página que os clientes veem — pior que não ter rede nenhuma.
 *
 * Então a regra é: aceitar tudo que a pessoa provavelmente vai digitar e sair
 * sempre com uma URL canônica (ou null, quando não dá pra confiar).
 */

/** Tira espaços, arroba, protocolo, www e barra final. */
function limpar(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/** Extrai o caminho quando o valor já é um link do domínio esperado. */
function caminhoDe(valor: string, dominios: string[]): string | null {
  const v = limpar(valor);
  for (const d of dominios) {
    if (v.toLowerCase().startsWith(d + "/")) return v.slice(d.length + 1);
    if (v.toLowerCase() === d) return "";
  }
  return null;
}

/** Usuário válido do Instagram: letras, números, ponto e underline. */
const HANDLE_IG = /^[A-Za-z0-9._]{1,30}$/;
/** Facebook aceita ponto, hífen e o clássico profile.php?id=... */
const HANDLE_FB = /^[A-Za-z0-9.-]{1,60}$/;

/**
 * @returns URL canônica do perfil, ou null se não der pra montar.
 */
export function instagramUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const caminho = caminhoDe(raw, ["instagram.com", "instagr.am"]);
  // Link colado traz sufixos do botão de compartilhar (?igsh=, /reel/...);
  // só o primeiro segmento é o perfil.
  const bruto = (caminho ?? limpar(raw)).split(/[/?#]/)[0];
  const handle = bruto.replace(/^@+/, "");
  if (!HANDLE_IG.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

export function facebookUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const caminho = caminhoDe(raw, ["facebook.com", "fb.com", "m.facebook.com", "web.facebook.com"]);

  // Página antiga sem vanity URL: /profile.php?id=100012345. O id vive na
  // query, então esse caso não passa pela regra de handle.
  if (caminho) {
    const m = caminho.match(/^profile\.php\?id=(\d+)/i);
    if (m) return `https://facebook.com/profile.php?id=${m[1]}`;
  }

  const handle = (caminho ?? limpar(raw)).split(/[/?#]/)[0].replace(/^@+/, "");
  if (!HANDLE_FB.test(handle)) return null;
  return `https://facebook.com/${handle}`;
}

/**
 * Google Meu Negócio é diferente das outras duas: não existe "usuário" que dê
 * pra completar. O link vem do próprio Google (Compartilhar → copiar), em
 * vários formatos. Sem um link, não há o que montar — e adivinhar levaria o
 * cliente pra ficha errada, que é pior do que não ter botão.
 */
const DOMINIOS_GOOGLE = [
  "g.page",
  "maps.app.goo.gl",
  "goo.gl",
  "share.google",
  "google.com",
  "maps.google.com",
  "google.com.br",
  "maps.google.com.br",
];

export function googleUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const v = limpar(raw);
  const dominio = v.split(/[/?#]/)[0].toLowerCase();
  if (!DOMINIOS_GOOGLE.includes(dominio)) return null;
  // Query preservada: os links de mapa carregam coordenadas e id do lugar.
  return `https://${v}`;
}

export type SocialLinks = {
  instagram: string | null;
  facebook: string | null;
  google: string | null;
};

/** Normaliza os três de uma vez. Vazio vira null — a tela some sozinha. */
export function socialLinks(s: {
  instagram?: string | null;
  facebook?: string | null;
  google_business?: string | null;
}): SocialLinks {
  return {
    instagram: instagramUrl(s.instagram),
    facebook: facebookUrl(s.facebook),
    google: googleUrl(s.google_business),
  };
}

export function hasSocial(links: SocialLinks): boolean {
  return !!(links.instagram || links.facebook || links.google);
}

/** "@barbeariamarcos" — o que a pessoa reconhece, não a URL inteira. */
export function instagramHandle(url: string | null): string | null {
  if (!url) return null;
  const h = url.split("/").pop();
  return h ? `@${h}` : null;
}
