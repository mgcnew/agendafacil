import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingApp } from "./BookingApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_salon", { p_slug: slug });
  const salon = data?.[0];

  if (!salon) {
    return { title: "Salão não encontrado" };
  }

  const title = `${salon.name} · Agende online`;
  const description = salon.address
    ? `Agende seu horário no ${salon.name} — ${salon.address}.`
    : `Agende seu horário online no ${salon.name} em poucos toques.`;
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
  const supabase = await createClient();

  const { data } = await supabase.rpc("public_salon", { p_slug: slug });
  const salon = data?.[0];
  if (!salon) notFound();

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
      {salon.is_demo && <DemoBanner niche={salon.niche as string} />}
      <BookingApp salon={salon} />
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
