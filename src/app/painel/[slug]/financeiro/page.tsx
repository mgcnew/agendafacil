import { redirect } from "next/navigation";
import { getMembershipBySlug } from "@/lib/salon";
import { guardFeature } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { currentMonthBR, monthRangeBR } from "@/lib/utils";
import { FinanceManager, type Receivable } from "./FinanceManager";
import type { FixedCost, ChairRental } from "./FixedCostsPanel";

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
  const validTab = tab === "comissoes" ? "comissoes" : tab === "fixos" ? "fixos" : "caixa";
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  await guardFeature(slug, "/financeiro");
  const salonId = membership.salon_id;
  const supabase = await createClient();

  // ── período de comissões (fuso do Brasil; servidor roda em UTC) ──
  const base = cmes && /^\d{4}-\d{2}$/.test(cmes) ? cmes : currentMonthBR();
  const [py, pm] = base.split("-").map(Number);
  const { start: periodStartIso, end: periodEndIso } = monthRangeBR(base);
  const lastDay = new Date(py, pm, 0).getDate();
  const periodStartStr = `${py}-${pad(pm)}-01`;
  const periodEndStr = `${py}-${pad(pm)}-${pad(lastDay)}`;
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
    .gte("appointments.starts_at", periodStartIso)
    .lte("appointments.starts_at", periodEndIso);

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
    .gte("used_at", periodStartIso)
    .lte("used_at", periodEndIso)
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

  // Atendimentos de hoje ainda não pagos (para "Receber de uma cliente")
  const { data: receivableRaw } = await supabase.rpc("receivable_today" as never, {
    p_salon: salonId,
  } as never);
  const receivable = (Array.isArray(receivableRaw) ? receivableRaw : []) as Receivable[];

  // Produtos de revenda (atalho de venda no caixa)
  const { data: resaleRaw } = await supabase
    .from("products")
    .select("id, name, sale_price, quantity")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .eq("is_resale", true)
    .order("name");
  const resaleProducts = (resaleRaw ?? []) as { id: string; name: string; sale_price: number; quantity: number }[];

  // ── fixos ──
  const [{ data: fixedCostsRaw }, { data: chairRaw }, { data: pkgsRaw }] = await Promise.all([
    supabase
      .from("fixed_costs" as never)
      .select("id, name, amount, due_day, type, is_active")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("salon_member_details")
      .select("chair_rent_amount, chair_rent_due_day, salon_members(display_name, is_active)")
      .eq("salon_id", salonId)
      .not("chair_rent_amount", "is", null)
      .gt("chair_rent_amount", 0),
    supabase
      .from("client_packages")
      .select("price")
      .eq("salon_id", salonId)
      .eq("status", "active"),
  ]);

  const fixedCosts = ((fixedCostsRaw ?? []) as FixedCost[]);

  const chairRentals: ChairRental[] = ((chairRaw ?? []) as Array<{
    chair_rent_amount: number;
    chair_rent_due_day: number | null;
    salon_members: { display_name: string | null; is_active: boolean } | null;
  }>)
    .filter((r) => r.salon_members?.is_active)
    .map((r) => ({
      member_name: r.salon_members?.display_name ?? "Profissional",
      amount: r.chair_rent_amount,
      due_day: r.chair_rent_due_day,
    }));

  const activePackages = {
    count: (pkgsRaw ?? []).length,
    total_value: (pkgsRaw ?? []).reduce((s: number, p: { price: number }) => s + Number(p.price), 0),
  };

  return (
    <FinanceManager
      salonId={salonId}
      canManage={membership.role !== "professional"}
      openSession={openSession}
      transactions={transactions}
      commissions={commissions}
      closedSessions={closedSessions ?? []}
      receivable={receivable}
      resaleProducts={resaleProducts}
      salon={{
        name: membership.salons.name,
        phone: membership.salons.phone,
        address: membership.salons.address,
        logo_url: membership.salons.logo_url,
      }}
      initialTab={validTab}
      fixedCosts={fixedCosts}
      chairRentals={chairRentals}
      activePackages={activePackages}
      period={{
        label: `${MONTHS[pm - 1]} ${py}`,
        prevCmes,
        nextCmes,
        start: periodStartStr,
        end: periodEndStr,
        startIso: periodStartIso,
        endIso: periodEndIso,
      }}
    />
  );
}
