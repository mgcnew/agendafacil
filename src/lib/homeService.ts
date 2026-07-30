/**
 * Taxa de deslocamento — espelho de `home_service_fee` no banco
 * (20260730_atendimento_domicilio_1_modelo.sql).
 *
 * Duplicação consciente, mesmo caso de `normalize_br_phone`: o banco calcula o
 * que vira cobrança, e aqui calculamos o que a tela mostra enquanto a pessoa
 * digita. Chamar a RPC a cada tecla seria uma ida ao servidor por caractere.
 *
 * Os testes fixam os valores que eu medi rodando a função SQL de verdade em
 * produção. Se um dos dois lados mudar sozinho, o teste quebra.
 */

import { formatBRL } from "./utils";

export type Tarifa = {
  /** Valor do primeiro quilômetro (cobre de 0 a 1 km). */
  firstKmFee: number;
  /** Valor de cada quilômetro seguinte. */
  extraKmFee: number;
};

/**
 * Arredonda o km PRA CIMA. É como toda tarifa de deslocamento é comunicada no
 * Brasil e é o que a pessoa confere de cabeça — 4,2 km cobra como 5 km. A tela
 * mostra o valor enquanto a profissional digita o km, então nunca vira
 * surpresa pra ela nem pra cliente.
 */
export function homeServiceFee(km: number | null | undefined, t: Tarifa): number {
  if (km === null || km === undefined || !Number.isFinite(km) || km <= 0) return 0;
  const cobrados = Math.max(Math.ceil(km) - 1, 0);
  return round2(t.firstKmFee + cobrados * t.extraKmFee);
}

/** Centavos somem em ponto flutuante: 0.1 + 0.2 não é 0.3. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** "R$ 5,00 o primeiro km + R$ 2,00 por km adicional" — a regra em uma linha. */
export function regraTarifa(t: Tarifa): string {
  return `${formatBRL(t.firstKmFee)} o primeiro km + ${formatBRL(t.extraKmFee)} por km adicional`;
}
