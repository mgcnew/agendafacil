import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard, type AdminOverview, type AdminSalon } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin" as never);
  if (!isAdmin) redirect("/");

  const [{ data: ov }, { data: salons }] = await Promise.all([
    supabase.rpc("admin_overview" as never),
    supabase.rpc("admin_list_salons" as never),
  ]);

  const overview = (Array.isArray(ov) ? ov[0] : ov) as AdminOverview | null;

  return (
    <AdminDashboard
      overview={overview ?? null}
      salons={(Array.isArray(salons) ? salons : []) as AdminSalon[]}
    />
  );
}
