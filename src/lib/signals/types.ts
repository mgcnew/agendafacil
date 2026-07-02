// Formato dos "sinais" que os funcionários (cada área do painel) reportam ao
// Gestor Zulan. Um sinal é sempre calculado por código (nunca por IA) e carrega
// os números REAIS já prontos — a IA só narra, nunca recalcula.

export type SignalKey =
  | "reactivation"
  | "birthday_today"
  | "package_expiring"
  | "package_dormant"
  | "low_stock";

export type Signal = {
  key: SignalKey;
  /** Quantos itens se encaixam no aviso (pacotes, clientes, produtos...). */
  count: number;
  /**
   * Frase curta com os números reais, pronta para a IA citar sem recalcular.
   * Ex.: "1 pacote vence em 0 dias (o mais próximo)".
   */
  fact: string;
};

/** Contexto ambiente que dá tom ao Gestor (não é um aviso em si). */
export type GestorContext = {
  firstName: string;
  salonName: string;
  apptsToday: number;
  revenueToday: number;
};

/** Cliente aniversariante (usado no card lateral e na ação de parabenizar). */
export type BirthdayContact = {
  id: string;
  name: string;
  phone: string | null;
  days_until: number;
  turning_age: number;
};

export type SignalsResult = {
  context: GestorContext;
  signals: Signal[];
  /** Lista completa de aniversariantes (p/ o card lateral do dashboard). */
  birthdays: BirthdayContact[];
};
