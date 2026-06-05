import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingApp } from "./BookingApp";

export const dynamic = "force-dynamic";

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
