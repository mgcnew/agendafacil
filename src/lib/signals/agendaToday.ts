import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfTodayBR, startOfTomorrowBR, todayInBR, formatTime } from "@/lib/utils";
import type { TodaySignals, LateClient } from "@/components/AgendaSignalsBanner";

/**
 * Sinais "de agora" da Agenda (cancelamento, atraso, horário livre) pro
 * Dashboard — mesma regra usada no banner da própria Agenda (AgendaManager.tsx
 * calcula isso ao vivo no cliente, com realtime). Aqui é a versão
 * server-side, sem cache: consulta leve (mesmo tipo que a Agenda já roda toda
 * vez que a página abre), então recalcular a cada visita ao Dashboard não tem
 * custo perceptível — o que é caro é a narração por IA, não a coleta do dado.
 *
 * Não inclui a estimativa de faturamento dos horários vazios (v2 da Agenda) —
 * fica de fora aqui de propósito, pra não duplicar a chamada de
 * `agenda_revenue_by_hour` em mais um lugar; a contagem de horários livres já
 * é o essencial pro aviso do Dashboard.
 */
export async function collectAgendaTodaySignals(
  supabase: SupabaseClient,
  salonId: string,
): Promise<TodaySignals & { waiting: number }> {
  const startDay = startOfTodayBR();
  const endDay = startOfTomorrowBR();

  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: todayAppts }, { data: activePros }, { data: proSvcRows }, { count: waiting }, { data: homeRows }, { data: quoteRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status, clients(full_name, phone)")
      .eq("salon_id", salonId)
      .gte("starts_at", startDay)
      .lt("starts_at", endDay),
    supabase.from("salon_members").select("id").eq("salon_id", salonId).eq("is_active", true),
    supabase.from("professional_services").select("member_id").eq("salon_id", salonId),
    // Quem pediu pra ser chamado se abrir vaga. É o que transforma "cancelou
    // um horário" em ação concreta em vez de um aviso solto.
    supabase
      .from("appointment_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("status", "waiting")
      .gte("preferred_date", todayStrForWaitlist()),
    // Pedidos de domicílio esperando a quilometragem. Não se limita a hoje de
    // propósito: a cliente pediu pra semana que vem e está esperando o valor
    // AGORA — esquecer isso não atrasa o atendimento, mata o agendamento.
    supabase
      .from("appointments")
      .select("id, starts_at, clients(full_name)")
      .eq("salon_id", salonId)
      .eq("service_mode", "home")
      .is("travel_km", null)
      .eq("status", "pending")
      .gte("starts_at", startDay)
      .order("starts_at")
      .limit(5),
    // Orçamentos enviados e sem resposta há mais de um dia. O corte de 24h é o
    // que separa "ela ainda vai ver" de "ela não vai responder" — abaixo disso
    // o aviso apareceria em todo domicílio recém-orçado e viraria mobília.
    supabase
      .from("appointments")
      .select("id, starts_at, clients(full_name, phone)")
      .eq("salon_id", salonId)
      .eq("service_mode", "home")
      .eq("status", "pending")
      .not("home_quote_at", "is", null)
      .lt("home_quote_at", ontem)
      .gte("starts_at", startDay)
      .order("starts_at")
      .limit(5),
  ]);

  type TodayAppt = {
    id: string; starts_at: string; status: string;
    clients: { full_name: string; phone: string | null } | null;
  };
  const list = (todayAppts as TodayAppt[] | null) ?? [];
  const now = Date.now();
  const cancelled = list.filter((a) => a.status === "cancelled").length;
  const lateClients: LateClient[] = list
    .filter((a) => (a.status === "pending" || a.status === "confirmed") && new Date(a.starts_at).getTime() < now)
    .map((a) => ({
      id: a.id,
      name: a.clients?.full_name ?? "Cliente",
      phone: a.clients?.phone ?? null,
      time: formatTime(a.starts_at),
    }));

  // Mesmo filtro da Agenda: só profissionais com pelo menos 1 serviço atribuído entram na conta de horário livre.
  const prosWithServices = new Set((proSvcRows ?? []).map((r) => (r as { member_id: string }).member_id));
  const proIds = ((activePros ?? []) as { id: string }[])
    .map((p) => p.id)
    .filter((id) => prosWithServices.has(id));

  const { year, month, day } = todayInBR();
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const availability = await Promise.all(
    proIds.map((id) =>
      supabase.rpc("get_availability", { p_salon: salonId, p_member: id, p_date: todayStr, p_duration: 30 }),
    ),
  );
  const slots = new Set<string>();
  for (const r of availability) for (const slot of (r.data as string[] | null) ?? []) slots.add(slot);

  type HomeRow = { id: string; starts_at: string; clients: { full_name: string } | null };
  const homeRequests = ((homeRows as HomeRow[] | null) ?? []).map((a) => ({
    id: a.id,
    name: a.clients?.full_name ?? "Cliente",
    time: formatTime(a.starts_at),
    date: a.starts_at,
  }));

  type QuoteRow = {
    id: string; starts_at: string;
    clients: { full_name: string; phone: string | null } | null;
  };
  const homeQuotes = ((quoteRows as QuoteRow[] | null) ?? []).map((a) => ({
    id: a.id,
    name: a.clients?.full_name ?? "Cliente",
    phone: a.clients?.phone ?? null,
    time: formatTime(a.starts_at),
    date: a.starts_at,
  }));

  return {
    cancelled,
    lateClients,
    emptySlots: slots.size,
    estimatedRevenue: null,
    homeRequests,
    homeQuotes,
    waiting: waiting ?? 0,
  };
}

/** Data de hoje no fuso do Brasil, no formato da coluna `preferred_date`. */
function todayStrForWaitlist() {
  const { year, month, day } = todayInBR();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
