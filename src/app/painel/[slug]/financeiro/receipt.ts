import { formatBRL } from "@/lib/utils";
import type { jsPDF as JsPDF } from "jspdf";

export type ReceiptItem = { name: string; price: number; professional?: string | null };

export type ReceiptData = {
  client: string | null;
  professional?: string | null;
  dateTime: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: string;
  fileBase: string;
};

export type CommissionLine = {
  date: string;
  service: string;
  client?: string | null;
  base?: number;
  percent?: number;
  commission: number;
};

export type CommissionReceiptData = {
  professional: string;
  periodLabel: string;
  issuedAt: string;
  lines: CommissionLine[];
  total: number;
  paid: number;
  outstanding: number;
  fileBase: string;
};

export type SalonInfo = {
  name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito", cartao: "Cartão", split: "Divisão",
};
export const payLabel = (m: string) => PAYMENT_LABELS[m] ?? m;

export type ClosingReportData = {
  date: string;
  openingAmount: number;
  totalIncome: number;
  totalExpense: number;
  incomeByMethod: Record<string, number>;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  countedDebito?: number | null;
  countedCredito?: number | null;
  countedPix?: number | null;
  suprimentoTotal?: number;
  sangriaTotal?: number;
  openedBy?: string | null;
  closedBy?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  entries?: ReportEntry[];
  fileBase: string;
};

export type ReportEntry = {
  createdAt: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  method?: string | null;
  category?: string | null;
};

/* ────────────────────────── helpers PDF (cupom térmico 80mm) ────────────────────────── */

const W = 80;          // largura do cupom (mm)
const M = 6;           // margem lateral
const CW = W - 2 * M;  // largura útil
const BOTTOM = 6;      // margem inferior

const lh = (size: number) => size * 0.42; // altura de linha aproximada (mm)

type Logo = { data: string; format: string };

/**
 * Carrega o logo e normaliza para PNG via canvas.
 * jsPDF não decodifica WEBP — passar o blob bruto faria `addImage` lançar e,
 * por causa do clip ativo, deixaria o documento inteiro recortado (PDF vazio).
 * Convertendo sempre para PNG eliminamos essa classe de falha.
 */
async function loadLogoPng(url: string): Promise<Logo | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("logo load failed"));
      im.src = url;
    });
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Máscara circular feita no canvas (confiável). Evita o clip do jsPDF, que
    // além de não recortar (logo quadrado) corrompia o restante do documento.
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return { data: canvas.toDataURL("image/png"), format: "PNG" };
  } catch {
    return null;
  }
}

type TextOpts = { size?: number; style?: "normal" | "bold"; color?: number; align?: "left" | "center" };

function para(doc: JsPDF, str: string, y: number, o: TextOpts = {}): number {
  const { size = 9, style = "normal", color = 0, align = "left" } = o;
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color);
  const x = align === "center" ? W / 2 : M;
  const lines = doc.splitTextToSize(String(str), CW);
  for (let i = 0; i < lines.length; i++) doc.text(lines[i], x, y + i * lh(size), { align });
  return y + lines.length * lh(size) + 1;
}

function row(
  doc: JsPDF,
  left: string,
  right: string,
  y: number,
  o: { size?: number; style?: "normal" | "bold"; color?: number; rightStyle?: "normal" | "bold" } = {},
): number {
  const { size = 9, style = "normal", color = 0, rightStyle } = o;
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color);
  const lines = doc.splitTextToSize(String(left), CW - 20);
  for (let i = 0; i < lines.length; i++) doc.text(lines[i], M, y + i * lh(size));
  doc.setFont("helvetica", rightStyle ?? style);
  doc.text(String(right), W - M, y, { align: "right" });
  return y + lines.length * lh(size) + 1;
}

function divider(doc: JsPDF, y: number) {
  doc.setDrawColor(205);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
}

function drawHeader(doc: JsPDF, salon: SalonInfo, logo: Logo | null, y: number): number {
  if (logo) {
    const size = 16;
    const cx = W / 2;
    const cy = y + size / 2;
    const r = size / 2;
    // logo já vem com máscara circular (PNG transparente) — sem clip do jsPDF
    doc.addImage(logo.data, logo.format, cx - r, cy - r, size, size);
    y += size + 3;
  } else {
    y += 1;
  }
  y = para(doc, salon.name, y, { size: 12, style: "bold", color: 20, align: "center" });
  const contact = [salon.phone, salon.address].filter(Boolean).join(" · ");
  if (contact) y = para(doc, contact, y - 0.5, { size: 7.5, color: 120, align: "center" });
  y += 2;
  divider(doc, y);
  return y + 4;
}

/** Constrói um cupom térmico de altura dinâmica usando duas passagens (medir → desenhar). */
async function buildThermal(
  salon: SalonInfo,
  draw: (doc: JsPDF, startY: number) => number,
): Promise<JsPDF> {
  const { default: jsPDF } = await import("jspdf");
  const logo = salon.logo_url ? await loadLogoPng(salon.logo_url) : null;

  const render = (doc: JsPDF): number => {
    let y = 9;
    y = drawHeader(doc, salon, logo, y);
    return draw(doc, y);
  };

  // 1ª passagem: medir altura final numa página descartável
  const scratch = new jsPDF({ unit: "mm", format: [W, 1000] });
  const finalY = render(scratch);

  // 2ª passagem: desenhar na página com altura exata
  const doc = new jsPDF({ unit: "mm", format: [W, finalY + BOTTOM] });
  render(doc);
  return doc;
}

/* ────────────────────────── cupom do cliente ────────────────────────── */

export async function generateReceiptPdf(r: ReceiptData, salon: SalonInfo) {
  const doc = await buildThermal(salon, (d, startY) => {
    let y = startY;
    y = para(d, "COMPROVANTE DE PAGAMENTO", y, { size: 8.5, style: "bold", color: 60, align: "center" });
    y += 1;
    y = para(d, `Data: ${r.dateTime}`, y, { size: 8, color: 90 });
    if (r.client) y = para(d, `Cliente: ${r.client}`, y, { size: 8, color: 90 });
    if (r.professional) y = para(d, `Profissional: ${r.professional}`, y, { size: 8, color: 90 });
    y += 1;
    divider(d, y);
    y += 4;

    const items = r.items.length ? r.items : [{ name: "Recebimento", price: r.total }];
    for (const it of items) {
      y = row(d, it.name, formatBRL(it.price), y, { size: 9 });
      if (it.professional && !r.professional) y = para(d, it.professional, y - 1.5, { size: 6.8, color: 145 });
    }

    y += 1;
    divider(d, y);
    y += 5;
    y = row(d, "TOTAL", formatBRL(r.total), y, { size: 11, style: "bold", rightStyle: "bold" });
    y += 1;
    y = para(d, `Forma de pagamento: ${payLabel(r.paymentMethod)}`, y, { size: 8.5, color: 70 });
    y += 3;
    divider(d, y);
    y += 4;
    y = para(d, "Obrigado pela preferência!", y, { size: 8.5, style: "bold", color: 90, align: "center" });
    y = para(d, "Te esperamos no próximo horário — agende já!", y, { size: 7.5, color: 120, align: "center" });
    y += 1.5;
    y = para(d, "Documento sem valor fiscal", y, { size: 7, color: 160, align: "center" });
    return y;
  });
  doc.save(`${r.fileBase}.pdf`);
}

/* ────────────────────────── comprovante de comissão ────────────────────────── */

export async function generateCommissionPdf(d: CommissionReceiptData, salon: SalonInfo) {
  const doc = await buildThermal(salon, (p, startY) => {
    let y = startY;
    y = para(p, "COMPROVANTE DE COMISSÃO", y, { size: 8.5, style: "bold", color: 60, align: "center" });
    y += 1;
    y = para(p, d.professional, y, { size: 9, style: "bold", color: 30 });
    y = para(p, `Período: ${d.periodLabel}`, y, { size: 8, color: 90 });
    y = para(p, `Emitido em: ${d.issuedAt}`, y, { size: 8, color: 90 });
    y += 1;
    divider(p, y);
    y += 4;

    for (const ln of d.lines) {
      y = row(p, `${ln.date}  ${ln.service}`, formatBRL(ln.commission), y, { size: 8 });
      const sub = [
        ln.client,
        ln.base != null ? `base ${formatBRL(ln.base)}` : null,
        ln.percent != null ? `${ln.percent}%` : null,
      ].filter(Boolean).join(" · ");
      if (sub) y = para(p, sub, y - 1.5, { size: 6.8, color: 145 });
      y += 0.5;
    }

    y += 1;
    divider(p, y);
    y += 5;
    y = row(p, "TOTAL APURADO", formatBRL(d.total), y, { size: 10.5, style: "bold", rightStyle: "bold" });
    if (d.paid > 0) {
      y = row(p, "Já pago", formatBRL(d.paid), y, { size: 8, color: 90 });
      y = row(p, "A pagar agora", formatBRL(d.outstanding), y, { size: 9, style: "bold", rightStyle: "bold" });
    }

    y += 9;
    p.setDrawColor(150);
    p.setLineWidth(0.2);
    p.line(M + 6, y, W - M - 6, y);
    y += 3.5;
    y = para(p, "Recebi o valor acima referente às comissões", y, { size: 6.8, color: 130, align: "center" });
    y += 2;
    divider(p, y);
    y += 4;
    y = para(p, "Documento sem valor fiscal", y, { size: 7, color: 160, align: "center" });
    return y;
  });
  doc.save(`${d.fileBase}.pdf`);
}

/* ────────────────────────── relatório de fechamento de caixa ────────────────────────── */

const CLOSING_METHODS: { key: string; label: string }[] = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "debito", label: "Débito" },
  { key: "credito", label: "Crédito" },
  { key: "cartao", label: "Cartão (leg.)" },
];

/* ───────── relatório A4 profissional ───────── */

const A4W = 210, A4H = 297, AMX = 16, ACW = A4W - 2 * AMX;
type RGB = [number, number, number];
const RC_INK: RGB        = [31, 41, 55];
const RC_MUTED: RGB      = [107, 114, 128];
const RC_FAINT: RGB      = [148, 163, 184];
const RC_LINE: RGB       = [226, 232, 240];
const RC_BG: RGB         = [248, 250, 252];
const RC_ACCENT: RGB     = [37, 99, 235];
const RC_ACCENT_DK: RGB  = [23, 37, 84];
const RC_POS: RGB        = [22, 163, 74];
const RC_NEG: RGB        = [220, 38, 38];
const RC_WHITE: RGB      = [255, 255, 255];
const RC_CONTACT: RGB    = [191, 219, 254];
const RC_LABEL: RGB      = [147, 197, 253];

const fmtDateTimeBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtShortDateTimeBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");

export async function generateClosingReportPdf(d: ClosingReportData, salon: SalonInfo): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const logo = salon.logo_url ? await loadLogoPng(salon.logo_url) : null;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const fill   = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const ink    = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font   = (size: number, style: "normal" | "bold" = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); };

  let page = 1;
  const drawFooter = () => {
    const fy = A4H - 12;
    stroke(RC_LINE); doc.setLineWidth(0.2); doc.line(AMX, fy, A4W - AMX, fy);
    font(7.5, "normal"); ink(RC_FAINT);
    doc.text("Documento sem valor fiscal", AMX, fy + 4);
    doc.text(`Emitido em ${fmtDateTimeBR(new Date().toISOString())}`, A4W / 2, fy + 4, { align: "center" });
    doc.text(`Página ${page}`, A4W - AMX, fy + 4, { align: "right" });
  };
  // Quebra de página quando não cabe o próximo bloco.
  const ensure = (y: number, need: number): number => {
    if (y + need > A4H - 18) { drawFooter(); doc.addPage(); page += 1; return 22; }
    return y;
  };

  // ── Cabeçalho (faixa de marca) ──
  fill(RC_ACCENT_DK); doc.rect(0, 0, A4W, 34, "F");
  let lx = AMX;
  if (logo) {
    const s = 18, cx = AMX + s / 2, cy = 17, r = s / 2;
    fill(RC_WHITE); doc.circle(cx, cy, r + 1.3, "F"); // anel branco atrás
    doc.addImage(logo.data, "PNG", cx - r, cy - r, s, s); // logo já é circular (PNG transparente)
    lx = AMX + s + 6;
  }
  ink(RC_WHITE); font(16, "bold");
  doc.text(doc.splitTextToSize(salon.name, ACW - (lx - AMX) - 46)[0] ?? salon.name, lx, 15);
  const contact = [salon.phone, salon.address].filter(Boolean).join("   •   ");
  if (contact) {
    font(8.5, "normal"); ink(RC_CONTACT);
    doc.text(doc.splitTextToSize(contact, ACW - (lx - AMX) - 46)[0] ?? contact, lx, 21);
  }
  font(8, "bold"); ink(RC_LABEL);
  doc.text("RELATÓRIO DE CAIXA", A4W - AMX, 14, { align: "right" });
  font(8.5, "normal"); ink(RC_CONTACT);
  doc.text("Fechamento", A4W - AMX, 20, { align: "right" });

  let y = 45;

  // ── Identificação ──
  font(11, "bold"); ink(RC_INK);
  doc.text("Resumo do fechamento", AMX, y);
  font(9, "normal"); ink(RC_MUTED);
  doc.text(`Data: ${d.date}`, AMX, y + 5.5);
  const metaRight: string[] = [];
  if (d.openedBy || d.openedAt) metaRight.push(`Aberto por ${d.openedBy ?? "—"}${d.openedAt ? ` · ${fmtDateTimeBR(d.openedAt)}` : ""}`);
  if (d.closedBy || d.closedAt) metaRight.push(`Fechado por ${d.closedBy ?? "—"}${d.closedAt ? ` · ${fmtDateTimeBR(d.closedAt)}` : ""}`);
  font(8.5, "normal"); ink(RC_MUTED);
  metaRight.forEach((t, i) => doc.text(t, A4W - AMX, y + i * 5, { align: "right" }));
  y += 14;

  // ── Cards de KPI ──
  const gap = 4;
  const cw = (ACW - 2 * gap) / 3;
  const ch = 22;
  const cards: { label: string; value: number; color: RGB; sign?: string }[] = [
    { label: "Entradas",      value: d.totalIncome,                    color: RC_POS,    sign: "+" },
    { label: "Saídas",        value: d.totalExpense,                   color: RC_NEG,    sign: d.totalExpense > 0 ? "−" : "" },
    { label: "Saldo líquido", value: d.totalIncome - d.totalExpense,   color: RC_ACCENT },
  ];
  cards.forEach((c, i) => {
    const x = AMX + i * (cw + gap);
    fill(RC_BG); stroke(RC_LINE); doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cw, ch, 2.2, 2.2, "FD");
    font(8, "normal"); ink(RC_MUTED);
    doc.text(c.label.toUpperCase(), x + 5, y + 7.5);
    font(15, "bold"); ink(c.color);
    doc.text(`${c.sign ?? ""}${formatBRL(c.value)}`, x + 5, y + 16.5);
  });
  y += ch + 9;

  // ── helpers de seção/tabela ──
  const section = (title: string) => {
    y = ensure(y, 16);
    font(9.5, "bold"); ink(RC_ACCENT_DK);
    doc.text(title.toUpperCase(), AMX, y);
    stroke(RC_ACCENT); doc.setLineWidth(0.6);
    doc.line(AMX, y + 1.8, AMX + 16, y + 1.8);
    y += 7;
  };
  const tableRow = (
    left: string, right: string,
    o: { bold?: boolean; color?: RGB; rightColor?: RGB } = {},
  ) => {
    const rh = 8;
    y = ensure(y, rh);
    font(9.5, o.bold ? "bold" : "normal"); ink(o.color ?? RC_INK);
    doc.text(left, AMX + 1, y);
    ink(o.rightColor ?? o.color ?? RC_INK); font(9.5, o.bold ? "bold" : "normal");
    doc.text(right, A4W - AMX - 1, y, { align: "right" });
    stroke(RC_LINE); doc.setLineWidth(0.15); doc.line(AMX, y + 2.8, A4W - AMX, y + 2.8);
    y += rh;
  };

  // ── Entradas por forma de pagamento ──
  section("Entradas por forma de pagamento");
  let anyMethod = false;
  for (const { key, label } of CLOSING_METHODS) {
    const v = d.incomeByMethod[key] ?? 0;
    if (v > 0) { tableRow(label, formatBRL(v)); anyMethod = true; }
  }
  if (!anyMethod) tableRow("Sem entradas registradas", formatBRL(0), { color: RC_MUTED, rightColor: RC_MUTED });
  tableRow("Total de entradas", formatBRL(d.totalIncome), { bold: true, rightColor: RC_POS });
  y += 6;

  // ── Conferência do dinheiro ──
  section("Conferência de caixa — dinheiro");
  tableRow("Abertura (troco inicial)", formatBRL(d.openingAmount));
  if ((d.suprimentoTotal ?? 0) > 0) tableRow("Suprimentos", `+${formatBRL(d.suprimentoTotal ?? 0)}`, { rightColor: RC_POS });
  if ((d.sangriaTotal ?? 0) > 0)    tableRow("Sangrias", `−${formatBRL(d.sangriaTotal ?? 0)}`, { rightColor: RC_NEG });
  tableRow("Esperado em caixa", formatBRL(d.expectedCash), { bold: true });
  if (d.countedCash != null) {
    tableRow("Contado (informado)", formatBRL(d.countedCash));
    const diff = d.difference ?? 0;
    const ok = Math.abs(diff) < 0.01;
    const c: RGB = ok ? RC_POS : diff > 0 ? RC_ACCENT : RC_NEG;
    const lbl = ok ? "Diferença" : diff > 0 ? "Diferença (sobra)" : "Diferença (falta)";
    const val = ok ? "Conferido" : diff > 0 ? `+${formatBRL(diff)}` : `−${formatBRL(Math.abs(diff))}`;
    tableRow(lbl, val, { bold: true, color: c, rightColor: c });
  }
  y += 6;

  // ── Conferência de cartões / PIX (quando informados) ──
  const conf: { title: string; expected: number; counted: number | null | undefined }[] = [
    { title: "Conferência — Débito",  expected: d.incomeByMethod["debito"] ?? 0,  counted: d.countedDebito },
    { title: "Conferência — Crédito", expected: d.incomeByMethod["credito"] ?? 0, counted: d.countedCredito },
    { title: "Conferência — PIX",     expected: d.incomeByMethod["pix"] ?? 0,     counted: d.countedPix },
  ];
  for (const it of conf) {
    if (it.counted == null || it.expected <= 0) continue;
    section(it.title);
    tableRow("Registrado no sistema", formatBRL(it.expected));
    tableRow("Informado na conferência", formatBRL(it.counted));
    const d2 = it.counted - it.expected;
    const ok = Math.abs(d2) < 0.01;
    const c: RGB = ok ? RC_POS : d2 > 0 ? RC_ACCENT : RC_NEG;
    const lbl = ok ? "Diferença" : d2 > 0 ? "Diferença (sobra)" : "Diferença (falta)";
    const val = ok ? "Conferido" : d2 > 0 ? `+${formatBRL(d2)}` : `−${formatBRL(Math.abs(d2))}`;
    tableRow(lbl, val, { bold: true, color: c, rightColor: c });
    y += 6;
  }

  // ── Atendimentos e lançamentos ──
  if (d.entries && d.entries.length) {
    const colDate = AMX + 1;
    const colDesc = AMX + 30;
    const colForma = AMX + 120;
    const colVal = A4W - AMX - 1;
    const entriesHeader = () => {
      fill(RC_BG); doc.rect(AMX, y - 4.6, ACW, 7, "F");
      font(7.5, "bold"); ink(RC_MUTED);
      doc.text("DATA / HORA", colDate, y);
      doc.text("DESCRIÇÃO", colDesc, y);
      doc.text("FORMA", colForma, y);
      doc.text("VALOR", colVal, y, { align: "right" });
      y += 6;
    };

    section(`Atendimentos e lançamentos (${d.entries.length})`);
    entriesHeader();
    for (const e of d.entries) {
      if (y + 7 > A4H - 18) { drawFooter(); doc.addPage(); page += 1; y = 22; entriesHeader(); }
      const isMove = e.category === "sangria" || e.category === "suprimento";
      const neg = e.type === "expense";
      font(8.5, "normal"); ink(RC_INK);
      doc.text(fmtShortDateTimeBR(e.createdAt), colDate, y);
      const desc = doc.splitTextToSize(e.description || (neg ? "Saída" : "Entrada"), colForma - colDesc - 3)[0] ?? "";
      doc.text(desc, colDesc, y);
      ink(RC_MUTED);
      const forma = isMove ? (e.category === "sangria" ? "Sangria" : "Suprimento") : payLabel(e.method ?? "dinheiro");
      doc.text(forma, colForma, y);
      ink(neg ? RC_NEG : RC_POS); font(8.5, "bold");
      doc.text(`${neg ? "−" : ""}${formatBRL(e.amount)}`, colVal, y, { align: "right" });
      stroke(RC_LINE); doc.setLineWidth(0.12); doc.line(AMX, y + 2.4, A4W - AMX, y + 2.4);
      y += 7;
    }
  }

  drawFooter();
  doc.save(`${d.fileBase}.pdf`);
}

export function buildClosingReportText(d: ClosingReportData, salon: SalonInfo): string {
  const lines = [
    `*Fechamento de Caixa — ${salon.name}*`,
    `Data: ${d.date}`,
    "",
    "*RESUMO DO DIA*",
    `Abertura: ${formatBRL(d.openingAmount)}`,
    `Entradas: ${formatBRL(d.totalIncome)}`,
  ];
  if (d.totalExpense > 0) lines.push(`Saídas: −${formatBRL(d.totalExpense)}`);
  lines.push(`*Saldo líquido: ${formatBRL(d.totalIncome - d.totalExpense)}*`);
  lines.push("");
  lines.push("*ENTRADAS POR FORMA*");
  for (const { key, label } of CLOSING_METHODS) {
    const v = d.incomeByMethod[key] ?? 0;
    if (v > 0) lines.push(`${label}: ${formatBRL(v)}`);
  }
  lines.push("");
  lines.push("*CONFERÊNCIA DO DINHEIRO*");
  if ((d.suprimentoTotal ?? 0) > 0) lines.push(`Suprimentos: +${formatBRL(d.suprimentoTotal ?? 0)}`);
  if ((d.sangriaTotal ?? 0) > 0) lines.push(`Sangrias: -${formatBRL(d.sangriaTotal ?? 0)}`);
  lines.push(`Esperado: ${formatBRL(d.expectedCash)}`);
  if (d.countedCash != null) {
    lines.push(`Contado: ${formatBRL(d.countedCash)}`);
    const diff = d.difference ?? 0;
    lines.push(`Diferença: ${Math.abs(diff) < 0.01 ? "Conferido ✓" : diff > 0 ? `+${formatBRL(diff)} (sobra)` : `−${formatBRL(Math.abs(diff))} (falta)`}`);
  }

  const confItems2: { title: string; expected: number; counted: number | null | undefined }[] = [
    { title: "CONFERÊNCIA DÉBITO",  expected: d.incomeByMethod["debito"] ?? 0,  counted: d.countedDebito },
    { title: "CONFERÊNCIA CRÉDITO", expected: d.incomeByMethod["credito"] ?? 0, counted: d.countedCredito },
    { title: "CONFERÊNCIA PIX",     expected: d.incomeByMethod["pix"] ?? 0,     counted: d.countedPix },
  ];
  for (const item of confItems2) {
    if (item.counted == null || item.expected <= 0) continue;
    const d2 = item.counted - item.expected;
    lines.push("");
    lines.push(`*${item.title}*`);
    lines.push(`Registrado: ${formatBRL(item.expected)}`);
    lines.push(`Informado: ${formatBRL(item.counted)}`);
    lines.push(`Diferença: ${Math.abs(d2) < 0.01 ? "Conferido ✓" : d2 > 0 ? `+${formatBRL(d2)} (sobra)` : `−${formatBRL(Math.abs(d2))} (falta)`}`);
  }

  lines.push("");
  lines.push("_Documento sem valor fiscal._");
  return lines.join("\n");
}

/* ────────────────────────── versões em texto (WhatsApp) ────────────────────────── */

export function buildReceiptText(r: ReceiptData, salon: SalonInfo): string {
  const lines = [`*Comprovante — ${salon.name}*`, `Data: ${r.dateTime}`];
  if (r.client) lines.push(`Cliente: ${r.client}`);
  if (r.professional) lines.push(`Profissional: ${r.professional}`);
  lines.push("");
  for (const i of r.items) lines.push(`• ${i.name} — ${formatBRL(i.price)}`);
  if (r.items.length) lines.push("");
  lines.push(`*Total: ${formatBRL(r.total)}*`);
  lines.push(`Pagamento: ${payLabel(r.paymentMethod)}`);
  lines.push("");
  lines.push("Obrigado pela preferência! 💜");
  lines.push("Te esperamos no próximo horário — agende já! 😊");
  lines.push("");
  lines.push("_Documento sem valor fiscal._");
  return lines.join("\n");
}

export function buildCommissionText(d: CommissionReceiptData, salon: SalonInfo): string {
  const lines = [
    `*Comprovante de comissão — ${salon.name}*`,
    `Profissional: ${d.professional}`,
    `Período: ${d.periodLabel}`,
    "",
  ];
  for (const ln of d.lines) {
    lines.push(`• ${ln.date} ${ln.service} — ${formatBRL(ln.commission)}`);
  }
  lines.push("");
  lines.push(`*Total apurado: ${formatBRL(d.total)}*`);
  if (d.paid > 0) {
    lines.push(`Já pago: ${formatBRL(d.paid)}`);
    lines.push(`*A pagar agora: ${formatBRL(d.outstanding)}*`);
  }
  lines.push("");
  lines.push("_Documento sem valor fiscal._");
  return lines.join("\n");
}
