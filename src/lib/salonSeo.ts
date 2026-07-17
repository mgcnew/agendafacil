/**
 * SEO local da página pública do salão (Fase 2).
 *
 * Com o endereço estruturado, a página passa a dizer AO Google onde o salão
 * fica: título/descrição com bairro e cidade, e um bloco de negócio local
 * (schema.org). Assim uma busca como "salão de beleza no [bairro]" pode
 * chegar até aqui — quem entrega o tráfego é o Google, não um diretório
 * nosso que ainda não tem público.
 *
 * Respeita a escolha de visibilidade: a própria RPC já corta rua/coordenada
 * quando a dona pediu "só o bairro", então aqui só montamos com o que veio.
 */

export type PublicSalonSeo = {
  name: string;
  niche: string | null;
  address: string | null;
  street: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  logo_url: string | null;
  address_visibility: string | null;
};

const NICHE_LABEL: Record<string, string> = {
  feminino: "Salão de beleza",
  barbearia: "Barbearia",
  estetica: "Clínica de estética",
  neutro: "Studio de beleza",
};

/** "no Centro, Blumenau" / "em Blumenau" / "" — pra emendar no título. */
export function localeSuffix(s: PublicSalonSeo): string {
  const bairro = s.neighborhood?.trim();
  const cidade = s.city?.trim();
  if (bairro && cidade) return ` no ${bairro}, ${cidade}`;
  if (cidade) return ` em ${cidade}`;
  if (bairro) return ` no ${bairro}`;
  return "";
}

export function seoTitle(s: PublicSalonSeo): string {
  return `${s.name} · Agende online`;
}

export function seoDescription(s: PublicSalonSeo): string {
  const tipo = NICHE_LABEL[s.niche ?? "neutro"] ?? "Salão";
  const onde = localeSuffix(s);
  if (onde) {
    return `${tipo}${onde}. Agende seu horário no ${s.name} pelo celular, em poucos toques.`;
  }
  // Sem endereço estruturado: cai no texto legível antigo, se houver.
  return s.address
    ? `Agende seu horário no ${s.name} — ${s.address}.`
    : `Agende seu horário online no ${s.name} em poucos toques.`;
}

/** Mapeia o nicho pro tipo mais específico de negócio no schema.org. */
function schemaType(niche: string | null): string {
  if (niche === "barbearia") return "HairSalon";
  if (niche === "estetica") return "HealthAndBeautyBusiness";
  return "BeautySalon";
}

/**
 * JSON-LD de negócio local. Só emite o bloco de endereço/geo com o que a RPC
 * liberou — em "hidden" sai um cartão sem endereço (ainda ajuda o nome a
 * indexar); em "neighborhood" sai bairro/cidade, sem rua nem coordenada.
 */
export function salonJsonLd(s: PublicSalonSeo, url: string): object | null {
  // Sem nenhum sinal de local e sem telefone, o bloco não agrega — melhor
  // não poluir com um LocalBusiness "oco".
  const temLocal = s.city || s.neighborhood || s.street || s.phone;
  if (!temLocal) return null;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType(s.niche),
    name: s.name,
    url,
  };
  if (s.phone) data.telephone = s.phone;
  if (s.logo_url) data.image = s.logo_url;

  const addr: Record<string, string> = {};
  const rua = [s.street, s.street_number].filter((x) => x?.trim()).join(", ");
  if (rua) addr.streetAddress = rua;
  if (s.city) addr.addressLocality = s.city;
  if (s.state) addr.addressRegion = s.state;
  if (s.cep) addr.postalCode = s.cep;
  addr.addressCountry = "BR";
  if (Object.keys(addr).length > 1) {
    data.address = { "@type": "PostalAddress", ...addr };
  }

  if (typeof s.lat === "number" && typeof s.lng === "number") {
    data.geo = { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng };
  }

  return data;
}
