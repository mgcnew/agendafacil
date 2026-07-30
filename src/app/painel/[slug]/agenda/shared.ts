/**
 * O pouco que a Agenda e o agendamento rápido precisam dividir.
 *
 * Existe porque o formulário de "Novo agendamento" deixou de morar só na
 * Agenda: ele agora também abre por cima do Caixa, dos Clientes ou de onde o
 * dono estiver. Só o que os dois lados usam vive aqui — o resto continua
 * dentro do AgendaManager, onde só faz sentido para a grade.
 */

export type Pro = {
  id: string;
  name: string;
  commission_percent: number;
  color: string | null;
  photo_url?: string | null;
};

export type Service = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  commission_percent: number | null;
  color?: string | null;
  allows_home_service?: boolean | null;
};

export type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  /** Endereço e distância só vêm preenchidos em quem já foi atendida em casa. */
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  distance_km?: number | null;
};

/** Configuração de domicílio do salão, o que a tela de agendar precisa saber. */
export type HomeConfig = {
  enabled: boolean;
  firstKmFee: number;
  extraKmFee: number;
};

export const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-07-29" → Date ao meio-dia local (foge do fuso virar o dia). */
export const parse = (s: string) => new Date(s + "T12:00:00");

/** Date → "2026-07-29" no fuso local. */
export const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
