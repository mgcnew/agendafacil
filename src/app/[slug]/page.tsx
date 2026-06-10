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

  const colorTheme = (salon.color_theme ?? "a") as string;

  return (
    <div
      data-niche={salon.niche}
      data-color={colorTheme}
      className="min-h-full bg-background text-foreground"
    >
      <BookingApp salon={salon} />
    </div>
  );
}
