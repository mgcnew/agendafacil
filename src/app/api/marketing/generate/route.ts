import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";
import { getCredits, consumeCredit } from "@/lib/marketing/credits";
import {
  buildImagePrompt,
  buildCaptionPrompt,
  sizeFor,
  type PromptInput,
  type AssetType,
  type Format,
  type Style,
} from "@/lib/marketing/prompts";
import type { Niche } from "@/lib/themes";
import { ALL_COLOR_VARIANTS } from "@/lib/themes";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  type: AssetType;
  style: Style;
  format: Format;
  note?: string;
  serviceId?: string;
  campaignId?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { slug, type, style, format } = body;
  if (!slug || !type || !style || !format) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  // Auth + permissão pelo salão (RLS garante o resto).
  const membership = await getMembershipBySlug(slug);
  if (!membership) {
    return NextResponse.json({ error: "Sem acesso a este salão." }, { status: 403 });
  }

  const supabase = await createClient();
  const salon = membership.salons;
  const salonId = membership.salon_id;

  // Dados auxiliares para a legenda (não obrigatórios).
  let serviceName: string | undefined;
  let price: string | undefined;
  let discount: string | undefined;

  if (body.serviceId) {
    const { data } = await supabase
      .from("services")
      .select("name, price, price_type")
      .eq("id", body.serviceId)
      .eq("salon_id", salonId)
      .maybeSingle();
    if (data) {
      serviceName = data.name;
      price = data.price_type === "on_request" ? "sob consulta" : `R$ ${Number(data.price).toFixed(2)}`;
    }
  }
  if (body.campaignId) {
    const { data } = await supabase
      .from("campaigns")
      .select("name, discount_percent")
      .eq("id", body.campaignId)
      .eq("salon_id", salonId)
      .maybeSingle();
    if (data) {
      serviceName = serviceName ?? data.name;
      discount = `${data.discount_percent}%`;
    }
  }

  // Paleta do tema do salão → cores do prompt.
  const variant = ALL_COLOR_VARIANTS.find((v) => v.id === (salon.color_theme ?? "a"));
  const promptInput: PromptInput = {
    type,
    style,
    format,
    niche: salon.niche as Niche,
    colorPrimary: variant?.primary ?? "#8e3b5e",
    colorAccent: variant?.accent ?? "#b98a2e",
    salonName: salon.name,
    note: body.note?.slice(0, 200),
  };

  const imagePrompt = buildImagePrompt(promptInput);
  const captionPrompt = buildCaptionPrompt({
    ...promptInput,
    serviceName,
    price,
    discount,
    bookingUrl: `${new URL(req.url).origin}/${slug}`,
  });

  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  // ─────────────────────────────────────────────────────────────────────
  // MODO LIVE (quando OPENAI_API_KEY estiver configurada) — TODO concluir.
  // Esqueleto pronto: só descomentar e instalar o SDK / usar fetch.
  // ─────────────────────────────────────────────────────────────────────
  if (hasOpenAI) {
    // Consome crédito ANTES de gastar a chamada paga.
    const consumed = await consumeCredit(supabase, salonId);
    if (!consumed.ok) {
      return NextResponse.json(
        { error: "Você não tem créditos de imagem este mês.", code: "no_credits" },
        { status: 402 },
      );
    }

    // TODO(openai): trocar pelo gpt-image-1 e gpt-4o-mini (legenda).
    //
    // const img = await fetch("https://api.openai.com/v1/images/generations", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     model: "gpt-image-1",
    //     prompt: imagePrompt,
    //     size: sizeFor(format),     // "1024x1536" | "1024x1024" | "1536x1024"
    //     n: 1,
    //   }),
    // }).then((r) => r.json());
    // const imageUrl = `data:image/png;base64,${img.data[0].b64_json}`;
    //  → fazer upload p/ Supabase Storage (bucket "marketing") e gravar em ai_generations.
    //
    // const cap = await fetch("https://api.openai.com/v1/chat/completions", { ... });
    // const caption = cap.choices[0].message.content.trim();

    return NextResponse.json(
      { error: "Geração ao vivo ainda não habilitada (faltam ajustes finais)." },
      { status: 501 },
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // MODO STUB (sem chave) — devolve uma prévia visual para validar toda a UI.
  // Não consome crédito (não é geração real).
  // ─────────────────────────────────────────────────────────────────────
  const imageUrl = placeholderSvg(format, variant?.primary ?? "#8e3b5e", variant?.accent ?? "#b98a2e");
  const caption = stubCaption(type, salon.name, serviceName, discount);
  const credits = await getCredits(supabase, salonId);

  return NextResponse.json({
    ok: true,
    mode: "stub" as const,
    imageUrl,
    caption,
    prompt: imagePrompt,
    captionPrompt,
    credits,
  });
}

/** Prévia: gradiente nas cores do salão + aviso de que a IA está pendente. */
function placeholderSvg(format: Format, primary: string, accent: string): string {
  const [w, h] = sizeFor(format).split("x").map(Number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g fill="#ffffff" opacity="0.92" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif">
    <text x="${w / 2}" y="${h / 2 - 10}" font-size="${Math.round(w / 18)}" font-weight="700">Prévia da arte</text>
    <text x="${w / 2}" y="${h / 2 + 30}" font-size="${Math.round(w / 32)}" opacity="0.85">IA será conectada em breve</text>
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function stubCaption(
  type: AssetType,
  salonName: string,
  serviceName?: string,
  discount?: string,
): string {
  if (type === "promotion")
    return `✨ Promoção no ${salonName}!${discount ? ` ${discount} OFF` : ""}${serviceName ? ` em ${serviceName}` : ""}. Garanta o seu horário 💖 #promoção #beleza #agende`;
  if (type === "service")
    return `💁‍♀️ ${serviceName ?? "Nosso serviço"} no ${salonName} com todo cuidado que você merece. Agende já! #beleza #autoestima #salão`;
  return `😍 Mais um resultado lindo aqui no ${salonName}! Vem viver essa experiência também. Agende seu horário 💕 #transformação #beleza #salão`;
}
