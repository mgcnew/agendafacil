// Roteiro no SANDBOX do Asaas: exercita as mesmas chamadas que o app usa
// (criar cliente e assinatura, link da cobrança em aberto, troca de valor,
// pagamento, cancelamento). Não toca no banco. Recusa rodar fora do sandbox.
// Uso: node scripts/asaas-sandbox-check.mjs .env.local
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.argv[2], "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/\\\$/g, "$")]),
);
const BASE = env.ASAAS_BASE_URL;
const KEY = env.ASAAS_API_KEY;
if (!BASE?.includes("sandbox") || !KEY?.startsWith("$aact_hmlg_")) {
  console.error("Abortado: não é sandbox."); process.exit(1);
}

async function api(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", access_token: KEY } });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
function cpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (arr) => { const s = arr.reduce((a, d, i) => a + d * (arr.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  n.push(dv(n)); n.push(dv(n)); return n.join("");
}
const pick = (ps) => ps.filter((p) => (p.status === "PENDING" || p.status === "OVERDUE") && p.invoiceUrl).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0] ?? null;
const ok = (c, msg) => { console.log((c ? "✓ " : "✗ ") + msg); if (!c) process.exitCode = 1; };
const due = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

// 1. CPF inválido → erro de validação legível
const bad = await api("/customers", { method: "POST", body: JSON.stringify({ name: "Teste Zulan", cpfCnpj: "11111111111" }) });
ok(bad.status === 400 && bad.body?.errors?.[0]?.description, `CPF inválido vira mensagem legível: "${bad.body?.errors?.[0]?.description}"`);

// 2. Cliente + assinatura (como no createCheckout)
const cus = await api("/customers", { method: "POST", body: JSON.stringify({ name: "Salão Teste Zulan", cpfCnpj: cpf(), externalReference: "teste-auditoria" }) });
ok(cus.status === 200 && cus.body.id, `cliente criado (${cus.body.id})`);
const sub = await api("/subscriptions", { method: "POST", body: JSON.stringify({ customer: cus.body.id, billingType: "UNDEFINED", cycle: "MONTHLY", value: 69.9, nextDueDate: due(1), description: "Assinatura Zulan — teste", externalReference: "teste-auditoria" }) });
ok(sub.status === 200 && sub.body.id, `assinatura criada (${sub.body.id})`);

// 3. Fatura em aberto → link de pagamento
let pays = (await api(`/subscriptions/${sub.body.id}/payments`)).body.data ?? [];
let open = pick(pays);
ok(!!open?.invoiceUrl, `link de pagamento da cobrança em aberto: ${open?.invoiceUrl}`);

// 4. Troca de plano antes de pagar (Pro → Básico)
const upd = await api(`/subscriptions/${sub.body.id}`, { method: "PUT", body: JSON.stringify({ value: 39.9, updatePendingPayments: true }) });
pays = (await api(`/subscriptions/${sub.body.id}/payments`)).body.data ?? [];
ok(upd.status === 200 && pick(pays)?.value === 39.9, `valor da cobrança pendente atualizado para ${pick(pays)?.value}`);

// 5. Pagamento confirmado (sandbox: receber em dinheiro)
const rec = await api(`/payments/${open.id}/receiveInCash`, { method: "POST", body: JSON.stringify({ paymentDate: new Date().toISOString().slice(0, 10), value: 39.9 }) });
pays = (await api(`/subscriptions/${sub.body.id}/payments`)).body.data ?? [];
const paid = pays.find((p) => p.id === open.id);
ok(rec.status === 200 && paid?.status === "RECEIVED_IN_CASH", `cobrança paga (status ${paid?.status}, vence ${paid?.dueDate})`);
ok(pick(pays)?.id !== open.id, "fatura paga não é mais oferecida como link de pagamento");

// 6. Cancelamento
const del = await api(`/subscriptions/${sub.body.id}`, { method: "DELETE" });
ok(del.status === 200 && del.body.deleted === true, "assinatura cancelada no Asaas");
const again = await api(`/subscriptions/${sub.body.id}`, { method: "DELETE" });
console.log(`  (cancelar de novo responde ${again.status} — o app trata 404 como já cancelada)`);
pays = (await api(`/subscriptions/${sub.body.id}/payments`)).body.data ?? [];
ok(!pick(pays), `depois de cancelar, nada fica em aberto para cobrar (${pays.length} cobrança(s) restante(s): ${pays.map((p) => p.status).join(", ")})`);
console.log(`\nIDs de teste (sandbox): cliente ${cus.body.id}, assinatura ${sub.body.id}`);
