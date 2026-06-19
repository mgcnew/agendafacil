import type { Niche } from "@/lib/themes";

/**
 * Biblioteca de marketing por IA.
 *
 * Filosofia: a dona escolhe poucas opções simples no front; aqui montamos um
 * prompt bem estruturado por trás. A IA gera APENAS a arte de fundo — nome,
 * preço, CTA e logo entram numa camada de texto editável por cima (ver
 * MarketingManager). Por isso todo prompt de imagem PROÍBE texto na arte e
 * pede espaço livre para o banner.
 */

/* ───────────────────────── Catálogos (front) ───────────────────────── */

export type AssetType = "service" | "promotion" | "client_work";
export type Format = "story" | "feed" | "facebook";
export type Style = "elegante" | "vibrante" | "clean" | "festivo";

export const ASSET_TYPES: {
  id: AssetType;
  label: string;
  desc: string;
  icon: string; // nome de ícone lucide
}[] = [
  {
    id: "promotion",
    label: "Promoção",
    desc: "Divulgar uma campanha com desconto que você já criou.",
    icon: "BadgePercent",
  },
  {
    id: "service",
    label: "Serviço",
    desc: "Destacar um serviço que você oferece e o preço.",
    icon: "Sparkles",
  },
  {
    id: "client_work",
    label: "Trabalho pronto",
    desc: "Mostrar o resultado de uma cliente (você envia a foto).",
    icon: "Camera",
  },
];

export const FORMATS: {
  id: Format;
  label: string;
  desc: string;
  /** tamanho técnico aceito pelo gpt-image-1 */
  size: "1024x1536" | "1024x1024" | "1536x1024";
  /** proporção para o preview no front (CSS aspect-ratio) */
  aspect: string;
}[] = [
  { id: "story", label: "Status / Stories", desc: "WhatsApp e Instagram (vertical)", size: "1024x1536", aspect: "9 / 16" },
  { id: "feed", label: "Feed do Instagram", desc: "Post quadrado", size: "1024x1024", aspect: "1 / 1" },
  { id: "facebook", label: "Capa do Facebook", desc: "Horizontal", size: "1536x1024", aspect: "16 / 9" },
];

export const STYLES: { id: Style; label: string; desc: string }[] = [
  { id: "elegante", label: "Elegante", desc: "Sofisticado, tons suaves, ar premium." },
  { id: "vibrante", label: "Vibrante", desc: "Cores fortes, chama atenção, jovem." },
  { id: "clean", label: "Clean", desc: "Minimalista, muito espaço, moderno." },
  { id: "festivo", label: "Festivo", desc: "Comemorativo, alegre, para datas especiais." },
];

/* ───────────────────────── Descritores internos ───────────────────────── */

const NICHE_ART: Record<Niche, string> = {
  feminino:
    "beauty salon and hairdressing studio aesthetic, soft hair-care and skincare imagery, delicate flowers, elegant cosmetics, warm spa ambience",
  barbearia:
    "modern barbershop aesthetic, grooming tools, clean masculine textures, leather and wood accents, classic-meets-modern vibe",
  estetica:
    "nail and aesthetics studio aesthetic, manicure and skincare imagery, soft gradients, polished and pristine surfaces, wellness mood",
  neutro:
    "clean professional beauty and wellness studio aesthetic, soft modern textures",
};

const STYLE_ART: Record<Style, string> = {
  elegante:
    "elegant and sophisticated, premium editorial mood, soft diffused lighting, refined composition, luxurious yet calm",
  vibrante:
    "vibrant and bold, energetic, high saturation, dynamic shapes, eye-catching and youthful",
  clean:
    "minimalist and clean, generous negative space, simple modern composition, subtle gradients, lots of breathing room",
  festivo:
    "festive and celebratory, joyful, tasteful decorative accents, warm inviting atmosphere",
};

const TYPE_ART: Record<AssetType, string> = {
  promotion:
    "promotional offer background that feels exciting and trustworthy, sense of a special deal without being tacky",
  service:
    "clean product/service showcase background that highlights a single beauty service",
  client_work:
    "elegant frame and background designed to surround a real client transformation photo",
};

/* ───────────────────────── Builders ───────────────────────── */

export type PromptInput = {
  type: AssetType;
  style: Style;
  format: Format;
  niche: Niche;
  colorPrimary: string; // hex do tema do salão
  colorAccent: string; // hex de destaque
  salonName: string;
  /** texto curto opcional que a dona digitou (ex.: nome do serviço/observação) */
  note?: string;
};

const ORIENTATION: Record<Format, string> = {
  story: "vertical 9:16 composition with a clear empty band at the TOP and BOTTOM for an overlaid text banner",
  feed: "square 1:1 composition with a clear empty area (top or bottom third) for an overlaid text banner",
  facebook: "horizontal 16:9 composition with a clear empty area on one side for an overlaid text banner",
};

/**
 * Monta o prompt da ARTE DE FUNDO. Regra de ouro: sem nenhum texto na imagem
 * (o texto vem na camada editável) e com espaço livre reservado para o banner.
 */
export function buildImagePrompt(input: PromptInput): string {
  const { type, style, format, niche, colorPrimary, colorAccent, note } = input;

  const parts = [
    `Professional social-media marketing background image for a Brazilian ${nicheWord(niche)}.`,
    NICHE_ART[niche],
    TYPE_ART[type],
    STYLE_ART[style],
    `Color palette built around ${colorPrimary} with ${colorAccent} accents, harmonious and on-brand.`,
    ORIENTATION[format],
    note ? `Theme hint: ${note}.` : "",
    // Restrições críticas para a camada de texto funcionar:
    "ABSOLUTELY NO text, no words, no letters, no numbers, no logos and no watermark anywhere in the image.",
    "Leave clean uncluttered negative space for an external text overlay. High quality, photographic or tasteful illustration, no people's faces in close detail unless abstract.",
  ];

  return parts.filter(Boolean).join(" ");
}

/** Prompt para a legenda (modelo de texto). Saída curta e pronta pra postar. */
export function buildCaptionPrompt(
  input: PromptInput & {
    serviceName?: string;
    price?: string;
    discount?: string;
    bookingUrl?: string;
  },
): string {
  const { type, salonName, serviceName, price, discount, bookingUrl, note } = input;

  const ctx: string[] = [`Salão: ${salonName}.`];
  if (type === "promotion") ctx.push(`Promoção${discount ? ` de ${discount}` : ""}${serviceName ? ` em ${serviceName}` : ""}.`);
  if (type === "service") ctx.push(`Divulgando o serviço${serviceName ? `: ${serviceName}` : ""}${price ? ` (${price})` : ""}.`);
  if (type === "client_work") ctx.push("Mostrando o resultado de um trabalho recém-feito numa cliente.");
  if (note) ctx.push(`Observação: ${note}.`);
  if (bookingUrl) ctx.push(`Link de agendamento: ${bookingUrl}.`);

  return [
    "Você é social media de salões de beleza no Brasil. Escreva UMA legenda curta (máx. 3 linhas) para postar no Instagram/WhatsApp.",
    "Tom acolhedor e brasileiro, 1–2 emojis no máximo, uma chamada para ação clara (agendar) e 3 a 5 hashtags relevantes ao final.",
    "Não invente preços nem datas além dos informados. Não use aspas.",
    "Contexto:",
    ...ctx,
  ].join(" ");
}

function nicheWord(niche: Niche): string {
  switch (niche) {
    case "feminino": return "beauty salon";
    case "barbearia": return "barbershop";
    case "estetica": return "nails & aesthetics studio";
    default: return "beauty studio";
  }
}

/** Mapeia o formato escolhido para o tamanho técnico da API de imagem. */
export function sizeFor(format: Format): string {
  return FORMATS.find((f) => f.id === format)!.size;
}
