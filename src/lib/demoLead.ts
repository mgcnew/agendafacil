/**
 * Texto do aceite de marketing do demo.
 *
 * Mora aqui, e não solto na tela, porque é o mesmo texto que vai gravado em
 * growth_leads.consent_text: a prova de LGPD só vale se for exatamente o que a
 * pessoa leu. Mudou a redação? Mude a versão junto — aceites antigos guardam a
 * redação antiga, que é o ponto.
 */
export const CONSENT_VERSION = "v1";

export const CONSENT_TEXT =
  "Aceito receber dicas, novidades e ofertas do Zulan por e-mail e WhatsApp. " +
  "Posso cancelar quando quiser.";

/** O que fica registrado como prova do aceite (texto + versão). */
export const CONSENT_RECORD = `[${CONSENT_VERSION}] ${CONSENT_TEXT}`;

/** Dias de teste liberados — mesmo prazo do trial no banco. */
export const TRIAL_DAYS = 14;

/** Aceita (11) 99100-0001 e afins; exige ao menos DDD + 8 dígitos. */
export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 10;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
