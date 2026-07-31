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

/**
 * Formato de gravação usado desde sempre pela página pública: `+5511987654321`.
 *
 * Devolve null pra qualquer coisa que não seja celular BR válido — é o que
 * impede o `+55` puro de virar cadastro. O `toE164` antigo montava
 * `"+55" + digits` sem olhar o resultado, então campo vazio, "abc" ou um
 * número pela metade viravam telefone "válido" que nunca recebe mensagem
 * nenhuma, sem ninguém perceber.
 *
 * O prefixo `+` fica de propósito: mudar o formato agora criaria cadastro
 * duplicado pra quem já está gravado assim.
 */
export function toStoredPhone(raw: string | null | undefined): string | null {
  const n = normalizeBrPhone(raw);
  return n ? `+${n}` : null;
}

/**
 * Máscara enquanto digita: 11987654321 → (11) 98765-4321.
 *
 * Formatar durante a digitação não é enfeite: sem os parênteses e o traço, um
 * dígito faltando passa despercebido — e um dígito faltando é exatamente o
 * defeito que enche a base de telefone que não recebe nada.
 */
export function maskBrPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara de exibição: 55 11 98765-4321 → (11) 98765-4321 */
export function formatBrPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  const sem55 = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (sem55.length !== 11) return e164;
  return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 7)}-${sem55.slice(7)}`;
}
