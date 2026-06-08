import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { FinanceManager } from "./FinanceManager";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const cmesOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const pad = (n: number) => String(n).padStart(2, "0");

export default async function FinanceiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; cmes?: string }>;
}) {
  const { slug } = await params;
  const { tab, cmes } = await searchParams;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  const salonId = membership.salon_id;
  const supabase = await createClient();

  // ── período de comissões ──
  const now = new Date();
  const base = cmes && /^\d{4}-\d{2}$/.test(cmes) ? cmes : cmesOf(now);
  const [py, pm] = base.split("-").map(Number);
  const periodStart = new Date(py, pm - 1, 1);
  const periodEnd = new Date(py, pm, 0, 23, 59, 59);
  const periodStartStr = `${py}-${pad(pm)}-01`;
  const periodEndStr = `${py}-${pad(pm)}-${pad(periodEnd.getDate())}`;
  const prevCmes = cmesOf(new Date(py, pm - 2, 1));
  const nextCmes = cmesOf(new Date(py, pm, 1));

  // ── caixa ──
  const { data: openSession } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("salon_id", salonId)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let transactions: Tables<"cash_transactions">[] = [];
  if (openSession) {
    const { data: tx } = await supabase
      .from("cash_transactions")
      .select("*")
      .eq("session_id", openSession.id)
      .order("created_at", { ascending: false });
    transactions = tx ?? [];
  }

  const { data: closedSessions } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("salon_id", salonId)
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(8);

  // ── comissões apuradas no período (atendimentos concluídos) ──
  const { data: commRows } = await supabase
    .from("appointment_services")
    .select("commission_amount, appointments!inner(member_id, status, starts_at, salon_members(display_name))")
    .eq("salon_id", salonId)
    .eq("appointments.status", "completed")
    .gte("appointments.starts_at", periodStart.toISOString())
    .lte("appointments.starts_at", periodEnd.toISOString());

  const earnedMap = new Map<string, { name: string; earned: number }>();
  for (const r of commRows ?? []) {
    const appt = r.appointments as unknown as {
      member_id: string;
      salon_members: { display_name: string | null } | null;
    };
    const key = appt.member_id;
    const name = appt.salon_members?.display_name ?? "Profissional";
    const cur = earnedMap.get(key) ?? { name, earned: 0 };
    cur.earned += Number(r.commission_amount);
    earnedMap.set(key, cur);
  }

  // ── comissões de uso de pacote no período ──
  const { data: redRows } = await supabase
    .from("package_redemptions")
    .select("commission_amount, member_id, salon_members(display_name)")
    .eq("salon_id", salonId)
    .gte("used_at", periodStart.toISOString())
    .lte("used_at", periodEnd.toISOString())
    .not("member_id", "is", null);
  for (const r of redRows ?? []) {
    if (!r.member_id) continue;
    const name = (r.salon_members as unknown as { display_name: string | null } | null)?.display_name ?? "Profissional";
    const cur = earnedMap.get(r.member_id) ?? { name, earned: 0 };
    cur.earned += Number(r.commission_amount);
    earnedMap.set(r.member_id, cur);
  }

  // ── já pago no período ──
  const { data: payRows } = await supabase
    .from("commission_payments")
    .select("member_id, amount")
    .eq("salon_id", salonId)
    .eq("period_start", periodStartStr);
  const paidMap = new Map<string, number>();
  for (const p of payRows ?? []) {
    paidMap.set(p.member_id, (paidMap.get(p.member_id) ?? 0) + Number(p.amount));
  }

  const commissions = Array.from(earnedMap.entries())
    .map(([member_id, v]) => ({ member_id, name: v.name, earned: v.earned, paid: paidMap.get(member_id) ?? 0 }))
    .sort((a, b) => b.earned - a.earned);

  return (
    <FinanceManager
      salonId={salonId}
      canManage={membership.role !== "professional"}
      openSession={openSession}
      transactions={transactions}
      commissions={commissions}
      closedSessions={closedSessions ?? []}
      initialTab={tab === "comissoes" ? "comissoes" : "caixa"}
      period={{
        label: `${MONTHS[pm - 1]} ${py}`,
        prevCmes,
        nextCmes,
        start: periodStartStr,
        end: periodEndStr,
      }}
    />
  );
}
