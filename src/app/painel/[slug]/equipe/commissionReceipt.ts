import { formatBRL } from "@/lib/utils";
import type { SalonInfo } from "../financeiro/receipt";

export type CommissionReceipt = {
  professional: string;
  amount: number;
  periodLabel: string; // ex.: "junho de 2026"
  dateLabel: string; // ex.: "19/06/2026"
  fileBase: string;
};

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

/** Recibo de pagamento de comissão em PDF (A4). jspdf carregado sob demanda. */
export async function generateCommissionReceiptPdf(r: CommissionReceipt, salon: SalonInfo) {
  const { default: jsPDF } = await import("jspdf");
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

  doc.setFontSize(13);
  doc.text("Recibo de pagamento de comissão", m, 44);

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Profissional: ${r.professional}`, m, 54);
  doc.text(`Período: ${r.periodLabel}`, m, 60);
  doc.text(`Data do pagamento: ${r.dateLabel}`, m, 66);
  doc.setTextColor(0);

  doc.setFontSize(20);
  doc.text(`Valor pago: ${formatBRL(r.amount)}`, m, 82);

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `Recebi do estabelecimento ${salon.name} a importância acima, referente a comissões do período.`,
    m,
    96,
    { maxWidth: 180 },
  );

  doc.setDrawColor(180);
  doc.line(m, 124, m + 90, 124);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(r.professional, m, 130);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Documento sem valor fiscal", m, 150);

  doc.save(`${r.fileBase}.pdf`);
}
