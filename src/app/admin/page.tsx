import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard, type AdminMetrics, type AdminSalon } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin" as never);
  if (!isAdmin) redirect("/");

  const [{ data: metrics }, { data: salons }] = await Promise.all([
    supabase.rpc("admin_metrics" as never),
    supabase.rpc("admin_list_salons" as never),
  ]);

  return (
    <AdminDashboard
      metrics={(metrics ?? null) as AdminMetrics | null}
      salons={(Array.isArray(salons) ? salons : []) as AdminSalon[]}
    />
  );
}
