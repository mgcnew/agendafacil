import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfTodayBR, startOfTomorrowBR } from "@/lib/utils";
import {
  REACTIVATION_MIN_DAYS,
  BIRTHDAY_WINDOW_DAYS,
  PACKAGE_DORMANT_DAYS,
  PACKAGE_EXPIRY_WINDOW_DAYS,
  daysUntilCalendarBR,
  daysSince,
  isLowStock,
} from "./rules";
import type { Signal, SignalsResult, BirthdayContact } from "./types";
import { getDismissedKeys } from "./dismissals";

/**
 * Coletor único de sinais do painel — o lugar de onde o Gestor Zulan (e só ele)
 * consulta tudo o que pode ser avisado ao dono. Cada "funcionário" (reativação,
 * aniversários, pacotes, estoque) é detectado aqui, por código, com os mesmos
 * limiares/fórmulas que as páginas usam (ver rules.ts). Isso elimina a
 * duplicação que antes vivia espalhada em page.tsx e computeGestorSignals e
 * garante que o aviso do dashboard nunca divirja do banner da página.
 */
export async function collectSignals(
  supabase: SupabaseClient,
  salonId: string,
  opts: { firstName: string; salonName: string },
): Promise<SignalsResult> {
  const startDay = startOfTodayBR();
  const endDay = startOfTomorrowBR();

  const [
    { data: todayAppts },
    { data: reactRaw },
    { data: bdayRaw },
    { data: pkgsRaw },
    { data: productsRaw },
    { data: servicesRaw },
    { data: serviceInsightRaw },
    { data: productInsightRaw },
    { data: winbackRaw },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("status, total_price")
      .eq("salon_id", salonId)
      .gte("starts_at", startDay)
      .lt("starts_at", endDay),
    supabase.rpc("report_reactivation" as never, { p_salon: salonId, p_min_days: REACTIVATION_MIN_DAYS } as never),
    supabase.rpc("upcoming_birthdays" as never, { p_salon: salonId, p_days: BIRTHDAY_WINDOW_DAYS } as never),
    supabase
      .from("client_packages")
      .select("purchased_at, expires_at, client_package_items(used)")
      .eq("salon_id", salonId)
      .eq("status", "active"),
    supabase.from("products").select("id, name, quantity, min_quantity, is_resale").eq("salon_id", salonId).eq("is_active", true),
    supabase.from("services").select("id, name").eq("salon_id", salonId).eq("is_active", true),
    supabase.rpc("service_insights" as never, { p_salon: salonId } as never),
    supabase.rpc("product_movement_stats" as never, { p_salon: salonId } as never),
    supabase.rpc("marketing_winback" as never, { p_salon: salonId } as never),
  ]);

  // ── Contexto (tom, não é aviso) ──────────────────────────────────────────
  const appts = (todayAppts ?? []) as { status: string; total_price: number }[];
  const revenueToday = appts
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((sum, a) => sum + Number(a.total_price), 0);

  const signals: Signal[] = [];

  // ── Reativação de clientes ───────────────────────────────────────────────
  const reactCount = Array.isArray(reactRaw) ? reactRaw.length : 0;
  if (reactCount > 0) {
    signals.push({
      key: "reactivation",
      count: reactCount,
      fact: `${reactCount} cliente${reactCount === 1 ? "" : "s"} passou do tempo habitual de retorno (sem voltar há ${REACTIVATION_MIN_DAYS}+ dias)`,
    });
  }

  // ── Aniversariantes ──────────────────────────────────────────────────────
  const birthdays = (Array.isArray(bdayRaw) ? bdayRaw : []) as BirthdayContact[];
  const birthdaysToday = birthdays.filter((b) => b.days_until === 0);
  if (birthdaysToday.length > 0) {
    const names = birthdaysToday.map((b) => b.name.split(" ")[0]).join(", ");
    signals.push({
      key: "birthday_today",
      count: birthdaysToday.length,
      fact: `${birthdaysToday.length} cliente${birthdaysToday.length === 1 ? " faz" : "s fazem"} aniversário hoje: ${names}`,
    });
  }

  // ── Pacotes: vencendo em breve + dormentes ───────────────────────────────
  const pkgs = (pkgsRaw ?? []) as {
    purchased_at: string;
    expires_at: string;
    client_package_items: { used: number }[] | null;
  }[];

  // Só pacotes que vencem HOJE ou nos próximos dias (data de calendário BR,
  // igual ao painel de pacotes). Já vencido (dias < 0) não é "vencendo em
  // breve" — não faz sentido o Gestor avisar algo que já passou.
  const expiringDays = pkgs
    .map((p) => daysUntilCalendarBR(p.expires_at))
    .filter((d) => d >= 0 && d <= PACKAGE_EXPIRY_WINDOW_DAYS);
  if (expiringDays.length > 0) {
    const min = Math.min(...expiringDays);
    const quando = min === 0 ? "o mais próximo vence hoje" : `o mais próximo vence em ${min} dia${min === 1 ? "" : "s"}`;
    signals.push({
      key: "package_expiring",
      count: expiringDays.length,
      fact: `${expiringDays.length} pacote${expiringDays.length === 1 ? "" : "s"} vencendo em breve — ${quando}`,
    });
  }

  const dormantCount = pkgs.filter((p) => {
    const noUsage = (p.client_package_items ?? []).every((it) => Number(it.used) === 0);
    return noUsage && daysSince(p.purchased_at) >= PACKAGE_DORMANT_DAYS;
  }).length;
  if (dormantCount > 0) {
    signals.push({
      key: "package_dormant",
      count: dormantCount,
      fact: `${dormantCount} cliente${dormantCount === 1 ? "" : "s"} comprou pacote e ainda não usou nenhuma sessão`,
    });
  }

  // ── Estoque mínimo ───────────────────────────────────────────────────────
  const products = (productsRaw ?? []) as { id: string; name: string; quantity: number; min_quantity: number; is_resale: boolean }[];
  const low = products.filter((p) => isLowStock(p.quantity, p.min_quantity));
  if (low.length > 0) {
    const names = low.map((p) => p.name).slice(0, 5).join(", ");
    signals.push({
      key: "low_stock",
      count: low.length,
      fact: `${low.length} produto${low.length === 1 ? "" : "s"} no estoque mínimo: ${names}`,
    });
  }

  // ── Serviços parados (mesma regra de "isDormant" da página Serviços:
  // ativo e zero agendamentos concluídos na janela de service_insights) ────
  const services = (servicesRaw ?? []) as { id: string; name: string }[];
  const serviceBookings = new Map<string, number>();
  for (const r of (serviceInsightRaw ?? []) as { service_id: string; bookings: number }[]) {
    serviceBookings.set(r.service_id, r.bookings);
  }
  const dormantServices = services.filter((s) => (serviceBookings.get(s.id) ?? 0) === 0);
  if (dormantServices.length > 0) {
    const names = dormantServices.map((s) => s.name).slice(0, 5).join(", ");
    signals.push({
      key: "service_dormant",
      count: dormantServices.length,
      fact: `${dormantServices.length} serviço${dormantServices.length === 1 ? "" : "s"} sem nenhum agendamento há 90+ dias: ${names}`,
    });
  }

  // ── Produtos de revenda parados (mesma regra de "dormant" da página
  // Estoque: revenda, ativo e zero saída na janela de product_movement_stats) ─
  const productConsumed = new Map<string, number>();
  for (const r of (productInsightRaw ?? []) as { product_id: string; consumed_qty: number }[]) {
    productConsumed.set(r.product_id, Number(r.consumed_qty));
  }
  const dormantProducts = products.filter((p) => p.is_resale && (productConsumed.get(p.id) ?? 0) === 0);
  if (dormantProducts.length > 0) {
    const names = dormantProducts.map((p) => p.name).slice(0, 5).join(", ");
    signals.push({
      key: "product_dormant",
      count: dormantProducts.length,
      fact: `${dormantProducts.length} produto${dormantProducts.length === 1 ? "" : "s"} de revenda sem nenhuma venda há 30+ dias: ${names}`,
    });
  }

  // ── Faltas recentes (mesmo balde "no_shows" que a Recuperação de clientes já usa) ─
  const winback = (winbackRaw ?? { no_shows: [] }) as { no_shows: unknown[] };
  const noShowCount = Array.isArray(winback.no_shows) ? winback.no_shows.length : 0;
  if (noShowCount > 0) {
    signals.push({
      key: "recent_no_shows",
      count: noShowCount,
      fact: `${noShowCount} cliente${noShowCount === 1 ? "" : "s"} faltou recentemente sem remarcar`,
    });
  }

  // Categorias que o dono dispensou hoje somem antes de chegar na IA — assim
  // nem gastamos narração com um aviso que ele já pediu pra esconder por hoje.
  const dismissed = await getDismissedKeys(supabase, salonId);
  const visibleSignals = dismissed.size > 0 ? signals.filter((s) => !dismissed.has(s.key)) : signals;

  return {
    context: {
      firstName: opts.firstName,
      salonName: opts.salonName,
      apptsToday: appts.length,
      revenueToday,
    },
    signals: visibleSignals,
    birthdays,
  };
}
