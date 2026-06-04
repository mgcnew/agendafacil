import { redirect } from "next/navigation";
import { getMyMemberships } from "@/lib/salon";

export const dynamic = "force-dynamic";

export default async function PainelIndex() {
  const memberships = await getMyMemberships();
  if (memberships.length === 0) redirect("/novo-salao");
  // vai para o primeiro salão (idealmente o que é dono)
  const owned = memberships.find((m) => m.role === "owner") ?? memberships[0];
  redirect(`/painel/${owned.salons.slug}`);
}
