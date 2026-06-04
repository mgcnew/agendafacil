import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { ClientsManager } from "./ClientsManager";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("salon_id", membership.salon_id)
    .order("full_name");

  const canManage =
    membership.role === "owner" ||
    membership.role === "manager" ||
    membership.role === "receptionist";

  return (
    <ClientsManager
      salonId={membership.salon_id}
      initial={clients ?? []}
      canManage={canManage}
    />
  );
}
