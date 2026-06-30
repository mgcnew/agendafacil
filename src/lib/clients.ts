/**
 * Sinais de cliente reaproveitados em vários lugares do painel (lista,
 * perfil) — v1 do roadmap de IA pra página de Clientes. Cálculo direto,
 * sem IA; ver docs/produto/zulan-2.0-roadmap-ia.md.
 */

export type ClientOverviewRow = {
  client_id: string;
  visits: number;
  total_spent: number;
  last_visit: string | null;
};

// Amostra mínima de clientes elegíveis pra "top %" fazer sentido — evita
// marcar alguém de VIP num salão com poucos clientes cadastrados.
const VIP_MIN_SAMPLE = 5;
// Evita 1 venda isolada (ex.: pacote caro comprado uma vez) parecer "VIP".
const VIP_MIN_VISITS = 2;
const VIP_TOP_PERCENT = 0.2;

/** IDs dos clientes no top 20% de gasto total do salão (amostra mínima aplicada). */
export function computeVipIds(overview: ClientOverviewRow[]): Set<string> {
  const eligible = overview.filter((o) => o.visits >= VIP_MIN_VISITS);
  if (eligible.length < VIP_MIN_SAMPLE) return new Set();
  const sorted = [...eligible].sort((a, b) => b.total_spent - a.total_spent);
  const cutoff = Math.max(1, Math.ceil(sorted.length * VIP_TOP_PERCENT));
  return new Set(sorted.slice(0, cutoff).map((o) => o.client_id));
}

/** Próximo aniversário a partir de uma data "YYYY-MM-DD" (ano de nascimento ignorado). */
export function nextBirthday(birthDate: string | null): { daysUntil: number; turningAge: number } | null {
  if (!birthDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const b = new Date(`${birthDate}T12:00:00`);
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
  const turningAge = next.getFullYear() - b.getFullYear();
  return { daysUntil, turningAge };
}
