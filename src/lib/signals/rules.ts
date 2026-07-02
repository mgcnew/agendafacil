// Fonte única das REGRAS de negócio dos avisos do painel (limiares + fórmulas).
//
// Tudo aqui é puro (sem IO, sem React, sem Supabase) — pode ser importado tanto
// pelos componentes de página ("use client") quanto pelo coletor de sinais que
// roda no servidor. É o que garante que o banner local de uma página e o aviso
// do Gestor Zulan no dashboard sempre concordem: os dois leem os mesmos números
// e o mesmo critério daqui.

/** Pacote "vencendo em breve": expira dentro dessa janela (em dias). */
export const PACKAGE_EXPIRY_WINDOW_DAYS = 7;
/** Pacote "dormente": comprado há tantos dias e ainda sem nenhuma sessão usada. */
export const PACKAGE_DORMANT_DAYS = 14;
/** Cliente "para reativar": sem retornar há pelo menos tantos dias (RPC). */
export const REACTIVATION_MIN_DAYS = 14;
/** Janela de aniversários considerada nos avisos (RPC). */
export const BIRTHDAY_WINDOW_DAYS = 31;

/**
 * Dias inteiros a partir de agora até a data ISO informada.
 * Positivo = no futuro; 0 = vence hoje; negativo = já passou.
 * Mesma fórmula usada no card de cada pacote e no aviso do Gestor.
 */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/** Dias inteiros decorridos desde a data ISO informada (sempre >= 0). */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/** Está vencendo dentro da janela (inclui o dia de hoje, exclui o que já venceu). */
export function isExpiringSoon(iso: string): boolean {
  const d = daysUntil(iso);
  return d >= 0 && d <= PACKAGE_EXPIRY_WINDOW_DAYS;
}

/** Produto no estoque mínimo: só conta quando há um mínimo definido (> 0). */
export function isLowStock(quantity: number, minQuantity: number): boolean {
  return Number(quantity) <= Number(minQuantity) && Number(minQuantity) > 0;
}
