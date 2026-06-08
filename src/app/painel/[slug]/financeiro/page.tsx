import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { FinanceManager } from "./FinanceManager";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  const salonId = membership.salon_id;
  const supabase = await createClient();

  // sessão de caixa aberta
  const { data: openSession } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("salon_id", salonId)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // transações da sessão aberta
  let transactions: Tables<"cash_transactions">[] = [];
  if (openSession) {
    const { data: tx } = await supabase
      .from("cash_transactions")
      .select("*")
      .eq("session_id", openSession.id)
      .order("created_at", { ascending: false });
    transactions = tx ?? [];
  }

  // últimas sessões fechadas (histórico)
  const { data: closedSessions } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("salon_id", salonId)
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(8);

  // comissões do mês (apenas atendimentos concluídos)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: commRows } = await supabase
    .from("appointment_services")
    .select("commission_amount, appointments!inner(member_id, status, starts_at, salon_members(display_name))")
    .eq("salon_id", salonId)
    .eq("appointments.status", "completed")
    .gte("appointments.starts_at", monthStart);

  const commMap = new Map<string, { name: string; total: number }>();
  for (const r of commRows ?? []) {
    const appt = r.appointments as unknown as {
      member_id: string;
      salon_members: { display_name: string | null } | null;
    };
    const key = appt.member_id;
    const name = appt.salon_members?.display_name ?? "Profissional";
    const cur = commMap.get(key) ?? { name, total: 0 };
    cur.total += Number(r.commission_amount);
    commMap.set(key, cur);
  }
  const commissions = Array.from(commMap.values()).sort((a, b) => b.total - a.total);

  return (
    <FinanceManager
      salonId={salonId}
      canManage={membership.role !== "professional"}
      openSession={openSession}
      transactions={transactions}
      commissions={commissions}
      closedSessions={closedSessions ?? []}
    />
  );
}
