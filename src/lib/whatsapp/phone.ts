/**
 * Normalização de telefone BR para E.164, espelho de `normalize_br_phone` no
 * banco (ver 20260727_whatsapp_enqueue.sql).
 *
 * Existe em duplicata de propósito: o banco valida o que vai pra fila, e aqui
 * validamos o que o dono digita pra pedir o código de pareamento. Mandar um
 * número torto pra Evolution não dá erro — gera um código vinculado ao
 * aparelho de outra pessoa, que nunca vai conectar e não diz por quê.
 *
 * Devolve null quando não dá pra confiar. Melhor recusar do que adivinhar.
 */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let d = raw.replace(/\D/g, "");
  if (!d) return null;

  // Tira o código do país se já veio
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    d = d.slice(2);
  }

  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = d.slice(0, 2);
  let numero = d.slice(2);

  // DDD válido no Brasil vai de 11 a 99
  if (Number(ddd) < 11) return null;

  if (numero.length === 8) {
    // 8 dígitos: celular antigo (começa em 6–9) ganha o 9; fixo não tem
    // WhatsApp, então descarta.
    if (!/^[6-9]/.test(numero)) return null;
    numero = `9${numero}`;
  }

  // Celular atual sempre começa com 9
  if (!numero.startsWith("9")) return null;

  return `55${ddd}${numero}`;
}

/** Máscara de exibição: 55 11 98765-4321 → (11) 98765-4321 */
export function formatBrPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  const sem55 = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (sem55.length !== 11) return e164;
  return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 7)}-${sem55.slice(7)}`;
}
