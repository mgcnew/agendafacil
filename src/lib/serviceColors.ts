/** Paleta curada de cores para serviços — distinguíveis e com bom contraste. */
export const SERVICE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
];

/** Cor padrão por índice (cicla a paleta) — usada ao criar serviços. */
export function defaultServiceColor(index: number): string {
  const n = SERVICE_COLORS.length;
  return SERVICE_COLORS[((index % n) + n) % n];
}
