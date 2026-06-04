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

  return (
    <div data-theme={salon.niche} className="min-h-full bg-background text-foreground">
      <BookingApp salon={salon} />
    </div>
  );
}
