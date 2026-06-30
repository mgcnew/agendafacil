/**
 * Consumo real por produto — v1 do roadmap de IA pra página Estoque.
 * Cálculo direto sobre `stock_movements` (já alimentado automaticamente por
 * atendimentos concluídos e vendas no caixa); sem IA generativa.
 * Ver docs/produto/zulan-2.0-roadmap-ia.md.
 */

export type ProductInsightRow = {
  product_id: string;
  consumed_qty: number;
  movements_count: number;
  last_movement_at: string | null;
};

export type ProductInsight = {
  consumedQty: number;
  movementsCount: number;
  lastMovementAt: string | null;
};

export const PRODUCT_INSIGHTS_WINDOW_DAYS = 30;

export function buildProductInsightMap(rows: ProductInsightRow[]): Record<string, ProductInsight> {
  const map: Record<string, ProductInsight> = {};
  for (const r of rows) {
    map[r.product_id] = {
      consumedQty: Number(r.consumed_qty),
      movementsCount: r.movements_count,
      lastMovementAt: r.last_movement_at,
    };
  }
  return map;
}

/** Dias até acabar, com base no ritmo de consumo da janela. null = sem consumo recente (não dá pra estimar). */
export function daysUntilStockout(quantity: number, insight: ProductInsight | undefined): number | null {
  if (!insight || insight.consumedQty <= 0) return null;
  const dailyRate = insight.consumedQty / PRODUCT_INSIGHTS_WINDOW_DAYS;
  if (dailyRate <= 0) return null;
  return Math.floor(quantity / dailyRate);
}
