import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("id", membership.salon_id)
    .single();

  if (!salon) redirect("/painel");

  return <SettingsForm salon={salon} canEdit={membership.role === "owner"} />;
}
