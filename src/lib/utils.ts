import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Formata o preço de um serviço conforme o tipo (exato, a partir de, sob consulta). */
export function formatServicePrice(price: number, priceType?: string | null): string {
  if (priceType === "on_request") return "Sob consulta";
  if (priceType === "from") return `A partir de ${formatBRL(price)}`;
  return formatBRL(price);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

const TZ = "America/Sao_Paulo";
// Brasil não adota horário de verão desde 2019 → offset fixo de -03:00.
const BR_OFFSET = "-03:00";
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Componentes da data ATUAL no fuso do Brasil — independente do fuso do
 * servidor (que em produção roda em UTC). Use em Server Components que
 * calculam "hoje"/"este mês" para não quebrar à noite no Brasil.
 */
export function todayInBR(): { year: number; month: number; day: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Início (00:00 BRT) do dia atual no Brasil, como instante UTC em ISO. */
export function startOfTodayBR(): string {
  const { year, month, day } = todayInBR();
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T00:00:00${BR_OFFSET}`).toISOString();
}

/** Início (00:00 BRT) do dia seguinte no Brasil, como instante UTC em ISO. */
export function startOfTomorrowBR(): string {
  const d = new Date(startOfTodayBR());
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Mês atual no Brasil no formato "YYYY-MM". */
export function currentMonthBR(): string {
  const { year, month } = todayInBR();
  return `${year}-${pad2(month)}`;
}

/** Limites [início, fim] de um mês "YYYY-MM" no Brasil, como instantes UTC ISO. */
export function monthRangeBR(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia
  return {
    start: new Date(`${y}-${pad2(m)}-01T00:00:00${BR_OFFSET}`).toISOString(),
    end: new Date(`${y}-${pad2(m)}-${pad2(lastDay)}T23:59:59${BR_OFFSET}`).toISOString(),
  };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatDateLong(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  });
}
