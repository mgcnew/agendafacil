import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AdminDashboard,
  type AdminMetrics, type AdminSalon, type AdminUser, type AuditEntry, type Announcement,
} from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin" as never);
  if (!isAdmin) redirect("/");

  const [{ data: metrics }, { data: salons }, { data: admins }, { data: audit }, { data: announcements }, { data: mrrHistory }] = await Promise.all([
    supabase.rpc("admin_metrics" as never),
    supabase.rpc("admin_list_salons" as never),
    supabase.rpc("admin_list_admins" as never),
    supabase.rpc("admin_audit" as never, { p_limit: 30 } as never),
    supabase.rpc("admin_list_announcements" as never),
    supabase.rpc("admin_mrr_history" as never),
  ]);

  return (
    <AdminDashboard
      metrics={(metrics ?? null) as AdminMetrics | null}
      salons={(Array.isArray(salons) ? salons : []) as AdminSalon[]}
      admins={(Array.isArray(admins) ? admins : []) as AdminUser[]}
      audit={(Array.isArray(audit) ? audit : []) as AuditEntry[]}
      announcements={(Array.isArray(announcements) ? announcements : []) as Announcement[]}
      mrrHistory={(Array.isArray(mrrHistory) ? mrrHistory : []) as { month: string; mrr: number }[]}
    />
  );
}
