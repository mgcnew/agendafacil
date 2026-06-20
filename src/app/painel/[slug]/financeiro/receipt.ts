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
  dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito", cartao: "Cartão",
};
export const payLabel = (m: string) => PAYMENT_LABELS[m] ?? m;

/* ────────────────────────── helpers PDF (cupom térmico 80mm) ────────────────────────── */

const W = 80;          // largura do cupom (mm)
const M = 6;           // margem lateral
const CW = W - 2 * M;  // largura útil
const BOTTOM = 6;      // margem inferior

const lh = (size: number) => size * 0.42; // altura de linha aproximada (mm)

type Logo = { data: string; format: string };

async function urlToDataUrl(url: string): Promise<Logo> {
  const res = await fetch(url);
  const blob = await res.blob();
  const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
  const data: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return { data, format };
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
    try {
      doc.addImage(logo.data, logo.format, (W - 14) / 2, y, 14, 14);
      y += 17;
    } catch {
      y += 1;
    }
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
  const logo = salon.logo_url ? await urlToDataUrl(salon.logo_url).catch(() => null) : null;

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
