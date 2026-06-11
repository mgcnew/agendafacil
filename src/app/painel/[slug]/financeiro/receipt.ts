import { formatBRL } from "@/lib/utils";

export type ReceiptData = {
  client: string | null;
  dateTime: string;
  items: { name: string; price: number }[];
  total: number;
  paymentMethod: string;
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

async function urlToDataUrl(url: string): Promise<{ data: string; format: string }> {
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

/** Gera o cupom não fiscal em PDF (A4) e baixa. jspdf carregado sob demanda. */
export async function generateReceiptPdf(r: ReceiptData, salon: SalonInfo) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const m = 14;
  let headerX = m;

  if (salon.logo_url) {
    try {
      const img = await urlToDataUrl(salon.logo_url);
      doc.addImage(img.data, img.format, m, 12, 18, 18);
      headerX = m + 24;
    } catch {
      // logo opcional — segue sem ele
    }
  }

  doc.setFontSize(16);
  doc.text(salon.name, headerX, 20);
  const contact = [salon.phone, salon.address].filter(Boolean).join("  ·  ");
  if (contact) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(contact, headerX, 26);
    doc.setTextColor(0);
  }

  doc.setFontSize(12);
  doc.text("Comprovante de pagamento", m, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Data: ${r.dateTime}`, m, 46);
  if (r.client) doc.text(`Cliente: ${r.client}`, m, 51);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: r.client ? 56 : 51,
    head: [["Item", "Valor"]],
    body: r.items.length ? r.items.map((i) => [i.name, formatBRL(i.price)]) : [["Recebimento", formatBRL(r.total)]],
    theme: "striped",
    headStyles: { fillColor: [242, 60, 16] },
    columnStyles: { 1: { halign: "right" } },
  });

  type Doc = typeof doc & { lastAutoTable?: { finalY: number } };
  const y = ((doc as Doc).lastAutoTable?.finalY ?? 60) + 8;
  doc.setFontSize(13);
  doc.text(`Total: ${formatBRL(r.total)}`, m, y);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Forma de pagamento: ${payLabel(r.paymentMethod)}`, m, y + 6);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Documento sem valor fiscal", m, y + 16);

  doc.save(`${r.fileBase}.pdf`);
}

/** Versão em texto do comprovante (para o WhatsApp, que não anexa o PDF). */
export function buildReceiptText(r: ReceiptData, salon: SalonInfo): string {
  const lines = [
    `*Comprovante — ${salon.name}*`,
    `Data: ${r.dateTime}`,
  ];
  if (r.client) lines.push(`Cliente: ${r.client}`);
  lines.push("");
  for (const i of r.items) lines.push(`• ${i.name} — ${formatBRL(i.price)}`);
  if (r.items.length) lines.push("");
  lines.push(`*Total: ${formatBRL(r.total)}*`);
  lines.push(`Pagamento: ${payLabel(r.paymentMethod)}`);
  lines.push("");
  lines.push("_Documento sem valor fiscal._");
  return lines.join("\n");
}
