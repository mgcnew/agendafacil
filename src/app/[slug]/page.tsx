import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JsonLd } from "@/components/InlineScript";
import {
  seoTitle,
  seoDescription,
  seoHeading,
  salonJsonLd,
  type PublicSalonSeo,
} from "@/lib/salonSeo";
import { BookingApp } from "./BookingApp";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

/**
 * Next chama generateMetadata E o componente da página no MESMO request, e os
 * dois precisam do salão. Sem memoizar, `public_salon` era executado duas
 * vezes por visita — o pg_stat_statements mostrava o dobro de chamadas do que
 * de páginas servidas. `cache()` vale por request, que é exatamente o escopo
 * certo aqui: nada de dado velho entre visitantes.
 */
const getSalon = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_salon", { p_slug: slug });
  return data?.[0] ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const salon = await getSalon(slug);

  if (!salon) {
    return { title: "Salão não encontrado" };
  }

  const seo = salon as unknown as PublicSalonSeo;
  const title = seoTitle(seo);
  const description = seoDescription(seo);
  const images = salon.logo_url ? [{ url: salon.logo_url as string }] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: salon.name as string,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default async function SalonBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();

  // Negócio local pro Google — só nos salões reais (demo não entra no índice).
  const jsonLd = salon.is_demo
    ? null
    : salonJsonLd(salon as unknown as PublicSalonSeo, `${SITE_URL}/${slug}`);

  // "" ou ausente → barbearia usa a identidade CSS nativa (:not([data-color]));
  // demais nichos caem em "a". Mesma regra do painel (layout.tsx).
  const rawColor = salon.color_theme as string | null | undefined;
  const colorAttr =
    rawColor && rawColor !== ""
      ? rawColor
      : salon.niche === "barbearia"
        ? undefined
        : "a";

  return (
    <div
      data-niche={salon.niche}
      data-color={colorAttr}
      className="min-h-dvh bg-background text-foreground"
    >
      {jsonLd && <JsonLd data={jsonLd} />}
      {salon.is_demo && <DemoBanner niche={salon.niche as string} />}
      <main>
        <h1 className="sr-only">{seoHeading(salon as unknown as PublicSalonSeo)}</h1>
        <BookingApp salon={salon} />
      </main>
    </div>
  );
}

/**
 * Faixa no topo dos salões demo: deixa claro que é um exemplo e convida a
 * criar o próprio teste, já levando a vertical (tipo) pro cadastro.
 */
function DemoBanner({ niche }: { niche: string }) {
  return (
    <a
      href={`/criar-salao?tipo=${encodeURIComponent(niche)}`}
      className="block bg-primary text-primary-foreground text-center text-sm font-medium px-4 py-2.5 hover:brightness-110 transition"
    >
      ✨ Este é um exemplo do Zulan. Gostou? <span className="underline underline-offset-2">Crie o seu grátis →</span>
    </a>
  );
}
