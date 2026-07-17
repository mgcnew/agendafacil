/**
 * Consulta de CEP — preenche o endereço do salão e, quando dá, a coordenada.
 *
 * Fonte principal: AwesomeAPI, que devolve lat/lng inclusive em cidade
 * pequena (testado). Reserva: BrasilAPI, pra não travar o cadastro se a
 * AwesomeAPI cair — só que a BrasilAPI hoje devolve `coordinates: {}` vazio,
 * então o fallback vem SEM coordenada. Por isso lat/lng é opcional em todo o
 * fluxo: endereço sem coordenada ainda serve pro SEO local, só não entra na
 * busca por distância (Fase 3).
 *
 * Ambas são gratuitas e sem chave — o que importa enquanto não há custo de
 * infra.
 */
export type CepLookup = {
  cep: string;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

export function onlyDigits(cep: string): string {
  return (cep ?? "").replace(/\D/g, "");
}

export function isValidCep(cep: string): boolean {
  return onlyDigits(cep).length === 8;
}

/** Formata 89010025 → 89010-025 (só visual). */
export function formatCep(cep: string): string {
  const d = onlyDigits(cep).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type AwesomeApiCep = {
  cep?: string;
  address?: string;
  district?: string;
  city?: string;
  state?: string;
  lat?: string;
  lng?: string;
};

type BrasilApiCep = {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

/** AwesomeAPI — traz coordenada. */
async function fromAwesome(digits: string): Promise<CepLookup | null> {
  const res = await fetch(`https://cep.awesomeapi.com.br/json/${digits}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as AwesomeApiCep;
  if (!d.city) return null;
  return {
    cep: digits,
    street: d.address?.trim() || null,
    neighborhood: d.district?.trim() || null,
    city: d.city?.trim() || null,
    state: d.state?.trim() || null,
    lat: toNumber(d.lat),
    lng: toNumber(d.lng),
  };
}

/** BrasilAPI — reserva, sem coordenada. */
async function fromBrasilApi(digits: string): Promise<CepLookup | null> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as BrasilApiCep;
  if (!d.city) return null;
  return {
    cep: digits,
    street: d.street?.trim() || null,
    neighborhood: d.neighborhood?.trim() || null,
    city: d.city?.trim() || null,
    state: d.state?.trim() || null,
    lat: null,
    lng: null,
  };
}

/** Busca o CEP. Devolve null se não existir ou se ambos os serviços caírem. */
export async function lookupCep(cep: string): Promise<CepLookup | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  try {
    const primary = await fromAwesome(digits);
    if (primary) return primary;
  } catch {
    // cai pra reserva
  }

  try {
    return await fromBrasilApi(digits);
  } catch {
    // Ambas fora / timeout: a dona digita na mão, não trava o cadastro.
    return null;
  }
}
