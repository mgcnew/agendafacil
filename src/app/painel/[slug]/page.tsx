import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMembershipBySlug } from "@/lib/salon";
import { getAccessStatus } from "@/lib/subscription";
import { planAllowsHref } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatTime, formatDate, startOfTodayBR, startOfTomorrowBR, currentMonthBR, monthRangeBR } from "@/lib/utils";
import { CalendarDots, Wallet, Clock, Users, Plus, Package, UserCheck, CaretRight, ClockCounterClockwise, Cake, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { TodayAgenda, type AgendaItem } from "./TodayAgenda";
import { type BirthdayClient } from "./BirthdayCard";
import { TomorrowReminders } from "./TomorrowReminders";
import { GestorInsightsAsync, GestorInsightsSkeleton } from "./GestorInsights";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  const salonId = membership.salon_id;

  const supabase = await createClient();
  // "Hoje" no fuso do Brasil — o servidor roda em UTC em produção.
  const startDay = startOfTodayBR();
  const endDay = startOfTomorrowBR();
  // Janela de "amanhã" (para os lembretes): [início de amanhã, início de depois de amanhã)
  const tomorrowEnd = (() => {
    const d = new Date(endDay);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  })();

  const [{ data: todayAppts }, { count: servicesCount }, { count: clientsCount }, { data: profile }, { data: activePkgs }, { data: reactRaw }, { data: bdayRaw }, { data: tomorrowAppts }, { data: recentRaw }, { data: productsRaw }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, status, total_price, member_id, clients(full_name, alert_summary), salon_members(display_name), appointment_services(name, price, duration_min)")
        .eq("salon_id", salonId)
        .gte("starts_at", startDay)
        .lt("starts_at", endDay)
        .order("starts_at"),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      supabase.from("profiles").select("full_name").eq("id", membership.profile_id).maybeSingle(),
      supabase
        .from("client_packages")
        .select("id, name, expires_at, clients(full_name), client_package_items(total, used)")
        .eq("salon_id", salonId)
        .eq("status", "active")
        .order("expires_at", { ascending: true })
        .limit(6),
      // Clientes para reativar — retorna erro (null) p/ quem não tem reports.view
      supabase.rpc("report_reactivation" as never, { p_salon: salonId, p_min_days: 14 } as never),
      // Aniversários do mês — janela ampliada para 31 dias
      supabase.rpc("upcoming_birthdays" as never, { p_salon: salonId, p_days: 31 } as never),
      // Agendamentos de amanhã (para lembrar) — só os que ainda vão acontecer
      supabase
        .from("appointments")
        .select("id, starts_at, clients(full_name, phone), appointment_services(name)")
        .eq("salon_id", salonId)
        .gte("starts_at", endDay)
        .lt("starts_at", tomorrowEnd)
        .in("status", ["pending", "confirmed"])
        .order("starts_at"),
      // Últimos atendimentos concluídos (excluindo hoje)
      supabase
        .from("appointments")
        .select("id, starts_at, clients(full_name), salon_members(display_name), appointment_services(name)")
        .eq("salon_id", salonId)
        .eq("status", "completed")
        .lt("starts_at", startDay)
        .order("starts_at", { ascending: false })
        .limit(6),
      // Pra alimentar o sinal de estoque mínimo no resumo do Gestor.
      supabase.from("products").select("quantity, min_quantity").eq("salon_id", salonId).eq("is_active", true),
    ]);

  const reactArr = reactRaw as unknown[] | null;
  const reactCount = Array.isArray(reactArr) ? reactArr.length : 0;
  const birthdays = (Array.isArray(bdayRaw) ? bdayRaw : []) as BirthdayClient[];

  type RecentAppt = { id: string; date: string; client: string; prof: string; services: string[] };
  const recentAppts: RecentAppt[] = (recentRaw ?? []).map((a) => ({
    id: a.id,
    date: formatDate(a.starts_at),
    client: (a.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
    prof: (a.salon_members as { display_name?: string } | null)?.display_name ?? "",
    services: ((a.appointment_services as { name: string }[] | null) ?? []).map((s) => s.name),
  }));

  const reminderItems = (tomorrowAppts ?? []).map((a) => ({
    id: a.id,
    time: formatTime(a.starts_at),
    client: (a.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
    phone: (a.clients as { phone?: string | null } | null)?.phone ?? null,
    services: ((a.appointment_services as { name: string }[] | null) ?? []).map((s) => s.name),
  }));
  const tomorrowLabel = formatDate(endDay);

  const pkgs = (activePkgs ?? []).map((p) => {
    const items = (p.client_package_items as unknown as { total: number; used: number }[]) ?? [];
    const total = items.reduce((a, i) => a + i.total, 0);
    const used = items.reduce((a, i) => a + i.used, 0);
    const dleft = Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / 86400000);
    return {
      id: p.id,
      client: (p.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
      name: p.name,
      remaining: total - used,
      dleft,
    };
  });

  // primeiro nome de quem está logado (perfil > nome de exibição no salão)
  const fullName = (profile?.full_name ?? membership.display_name ?? "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "";

  // ── Minhas comissões (profissional/gerente, só Pro/Max) ──────────
  const access = await getAccessStatus(slug);
  const earnsCommission = membership.role === "professional" || membership.role === "manager";
  const showMyComm = earnsCommission && planAllowsHref(access?.effective_plan ?? null, "/financeiro");

  let myComm: { earned: number; paid: number; toReceive: number; monthLabel: string } | null = null;
  if (showMyComm) {
    const ym = currentMonthBR();
    const { start, end } = monthRangeBR(ym);
    const periodStartStr = `${ym}-01`;
    const [svc, red, pays] = await Promise.all([
      supabase
        .from("appointment_services")
        .select("commission_amount, appointments!inner(member_id, status, starts_at)")
        .eq("salon_id", salonId)
        .eq("appointments.member_id", membership.id)
        .eq("appointments.status", "completed")
        .gte("appointments.starts_at", start)
        .lte("appointments.starts_at", end),
      supabase
        .from("package_redemptions")
        .select("commission_amount")
        .eq("salon_id", salonId)
        .eq("member_id", membership.id)
        .gte("used_at", start)
        .lte("used_at", end),
      supabase
        .from("commission_payments")
        .select("amount")
        .eq("salon_id", salonId)
        .eq("member_id", membership.id)
        .eq("period_start", periodStartStr),
    ]);
    const earned =
      (svc.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0) +
      (red.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);
    const paid = (pays.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const monthLabel = new Date(`${ym}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    myComm = { earned, paid, toReceive: Math.max(0, earned - paid), monthLabel };
  }

  const appts = todayAppts ?? [];
  const revenue = appts
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((sum, a) => sum + Number(a.total_price), 0);

  const agendaItems: AgendaItem[] = appts.map((a) => {
    const clientObj = a.clients as { full_name?: string; alert_summary?: string | null } | null;
    const svcs = (a.appointment_services as { name: string; price: number; duration_min: number }[] | null) ?? [];
    return {
      id: a.id,
      starts_at: a.starts_at,
      time: formatTime(a.starts_at),
      client: clientObj?.full_name ?? "Cliente",
      alert: clientObj?.alert_summary ?? null,
      prof: (a.salon_members as { display_name?: string } | null)?.display_name ?? "",
      status: a.status,
      price: Number(a.total_price),
      services: svcs.map((s) => ({ name: s.name, price: Number(s.price), duration: s.duration_min })),
    };
  });

  const stats = [
    { icon: CalendarDots, label: "Agendamentos hoje", value: String(appts.length) },
    { icon: Wallet, label: "Previsão de hoje", value: formatBRL(revenue) },
    { icon: Sparkle, label: "Serviços ativos", value: String(servicesCount ?? 0) },
    { icon: Users, label: "Clientes", value: String(clientsCount ?? 0) },
  ];

  // Sinais para o "Gestor Zulan" — a geração roda atrás de um Suspense (ver
  // abaixo) pra nunca atrasar o resto do Dashboard na 1ª visita do dia.
  const birthdaysTodayList = birthdays.filter((b) => b.days_until === 0);
  const birthdaysToday = birthdaysTodayList.length;
  const pkgsExpiringSoonList = pkgs.filter((p) => p.dleft >= 0 && p.dleft <= 3);
  const pkgsExpiringSoon = pkgsExpiringSoonList.length;
  const pkgsMinDaysLeft = pkgsExpiringSoon > 0 ? Math.min(...pkgsExpiringSoonList.map((p) => p.dleft)) : null;
  const products = (productsRaw ?? []) as { quantity: number; min_quantity: number }[];
  const productsLowCount = products.filter(
    (p) => Number(p.quantity) <= Number(p.min_quantity) && Number(p.min_quantity) > 0,
  ).length;
  const gestorSignals = {
    firstName,
    salonName: membership.salons.name,
    apptsToday: appts.length,
    revenueToday: revenue,
    reactivateCount: reactCount,
    birthdaysToday,
    birthdaysSoon: Math.max(0, birthdays.length - birthdaysToday),
    pkgsExpiringSoon,
    pkgsMinDaysLeft,
    productsLowCount,
  };

  return (
    <div className="space-y-6 af-rise">
      {/* Header — sempre largura total */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Olá{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-muted-foreground text-sm">Aqui está o resumo de hoje.</p>
        </div>
        <Link
          href={`/painel/${slug}/agenda?novo=1`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Novo agendamento
        </Link>
      </div>

      {/* Desktop: 2 colunas. Mobile: coluna única */}
      <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">

        {/* ── Coluna principal ──────────────────────────────────�� */}
        <div className="space-y-6 min-w-0">
          {/* Resumo do Gestor Zulan — streaming: não bloqueia o resto da página */}
          <Suspense fallback={<GestorInsightsSkeleton />}>
            <GestorInsightsAsync
              slug={slug}
              supabase={supabase}
              salonId={salonId}
              signals={gestorSignals}
              birthdayClients={birthdaysTodayList.map((b) => ({ id: b.id, name: b.name, phone: b.phone }))}
            />
          </Suspense>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-[var(--radius)] border border-border bg-card p-5">
                <s.icon className="h-5 w-5 text-primary" />
                <p className="font-display text-2xl font-bold mt-3">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Agenda de hoje */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Agenda de hoje
            </h2>
            {appts.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nenhum agendamento para hoje ainda.
              </div>
            ) : (
              <TodayAgenda items={agendaItems} salonId={salonId} />
            )}
          </div>
        </div>

        {/* ── Sidebar contextual ───────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          {/* Últimos atendimentos */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-4">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <ClockCounterClockwise className="h-4 w-4 text-primary" /> Últimos atendimentos
            </h2>
            {recentAppts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum atendimento concluído ainda.</p>
            ) : (
              <div className="space-y-2">
                {recentAppts.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.client}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.services.join(", ")}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{a.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aniversariantes do mês */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-4">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Cake className="h-4 w-4 text-primary" /> Aniversariantes do mês
            </h2>
            {birthdays.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum aniversariante nos próximos 31 dias.</p>
            ) : (
              <div className="space-y-2">
                {birthdays.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.days_until === 0 ? "hoje 🎉" : b.days_until === 1 ? "amanhã" : `em ${b.days_until} dias`}
                        {b.turning_age ? ` · ${b.turning_age} anos` : ""}
                      </p>
                    </div>
                    {b.phone && (
                      <a
                        href={`https://wa.me/55${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Feliz aniversário, ${b.name.split(" ")[0]}! 🎂`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Parabenizar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerta: clientes para reativar */}
          {reactCount > 0 && (
            <Link
              href={`/painel/${slug}/relatorios?tab=reativacao`}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/10 p-4 transition hover:bg-amber-500/15"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-600">
                <UserCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {reactCount} cliente{reactCount === 1 ? "" : "s"} para reativar
                </p>
                <p className="text-xs text-muted-foreground">
                  {reactCount === 1 ? "Passou" : "Passaram"} do ritmo habitual de retorno.
                </p>
              </div>
              <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )}

          {/* Minhas comissões (profissional/gerente) */}
          {myComm && (
            <div className="rounded-[var(--radius)] border border-primary/30 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4 text-primary" /> Minhas comissões ·{" "}
                <span className="capitalize text-muted-foreground text-xs">{myComm.monthLabel}</span>
              </p>
              <p className="font-display text-3xl font-bold text-primary mt-2">{formatBRL(myComm.toReceive)}</p>
              <p className="text-xs text-muted-foreground">a receber este mês</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Apurado: <b className="text-foreground">{formatBRL(myComm.earned)}</b></span>
                <span>Já pago: <b className="text-foreground">{formatBRL(myComm.paid)}</b></span>
              </div>
            </div>
          )}

          {/* Lembretes de amanhã */}
          <TomorrowReminders items={reminderItems} dateLabel={tomorrowLabel} salonName={membership.salons.name} />

          {/* Pacotes ativos */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Pacotes ativos
              </h2>
              {pkgs.length > 0 && (
                <Link href={`/painel/${slug}/pacotes`} className="text-xs text-primary font-medium">
                  Ver todos
                </Link>
              )}
            </div>
            {pkgs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum pacote ativo no momento.</p>
            ) : (
              <div className="space-y-2">
                {pkgs.map((p) => {
                  const soon = p.dleft <= 3;
                  return (
                    <Link
                      key={p.id}
                      href={`/painel/${slug}/pacotes`}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3 py-2 hover:bg-muted/50 transition"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.client}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.name} · {p.remaining} restante{p.remaining === 1 ? "" : "s"}</p>
                      </div>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${
                        soon ? "bg-red-500/12 text-red-600" : "bg-muted text-muted-foreground"
                      }`}>
                        {p.dleft >= 0 ? `${p.dleft}d` : "vencido"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
