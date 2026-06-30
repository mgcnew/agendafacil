/**
 * Histórico real de uso por serviço — v1 do roadmap de IA pra página
 * Serviços. Cálculo direto (sem IA); ver docs/produto/zulan-2.0-roadmap-ia.md.
 */

export type ServiceInsightRow = {
  service_id: string;
  bookings: number;
  revenue: number;
  avg_commission: number;
  last_booked: string | null;
};

export type ServiceInsight = {
  bookings: number;
  revenue: number;
  avgCommission: number;
  lastBooked: string | null;
};

export function buildServiceInsightMap(rows: ServiceInsightRow[]): Record<string, ServiceInsight> {
  const map: Record<string, ServiceInsight> = {};
  for (const r of rows) {
    map[r.service_id] = {
      bookings: r.bookings,
      revenue: Number(r.revenue),
      avgCommission: Number(r.avg_commission),
      lastBooked: r.last_booked,
    };
  }
  return map;
}
