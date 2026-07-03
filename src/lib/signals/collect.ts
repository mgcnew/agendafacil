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
    supabase.from("products").select("name, quantity, min_quantity").eq("salon_id", salonId).eq("is_active", true),
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
  const products = (productsRaw ?? []) as { name: string; quantity: number; min_quantity: number }[];
  const low = products.filter((p) => isLowStock(p.quantity, p.min_quantity));
  if (low.length > 0) {
    const names = low.map((p) => p.name).slice(0, 5).join(", ");
    signals.push({
      key: "low_stock",
      count: low.length,
      fact: `${low.length} produto${low.length === 1 ? "" : "s"} no estoque mínimo: ${names}`,
    });
  }

  return {
    context: {
      firstName: opts.firstName,
      salonName: opts.salonName,
      apptsToday: appts.length,
      revenueToday,
    },
    signals,
    birthdays,
  };
}
