"use client";

import { parsePlanParam, type PlanId } from "@/lib/plans";

/**
 * Plano escolhido no card da landing, guardado entre as etapas do cadastro.
 *
 * A query string (?plano=) já carrega a escolha, mas ela se perde quando o
 * cadastro exige confirmação de e-mail — a pessoa sai, clica no link da caixa
 * de entrada e volta numa URL limpa. Este armazenamento é a rede de segurança
 * pra essa volta.
 *
 * É só uma preferência de navegação, não uma decisão de cobrança: quem decide
 * o que será cobrado é a tela de assinatura, com o plano visível e confirmado
 * pela pessoa.
 */
const KEY = "zulan:plano-escolhido";

export function storeChosenPlan(plan: PlanId | null): void {
  try {
    if (plan) localStorage.setItem(KEY, plan);
    else localStorage.removeItem(KEY);
  } catch {
    // Navegação privada / storage bloqueado: seguir sem a reserva é aceitável,
    // a pessoa só escolhe o plano na tela de assinatura.
  }
}

export function readChosenPlan(): PlanId | null {
  try {
    return parsePlanParam(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** Chamar assim que o plano cumprir seu papel, pra não vazar pro próximo salão. */
export function clearChosenPlan(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}
