import { formatBRL } from "@/lib/utils";
import type { ReportData } from "./ReportsView";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito", cartao: "Cartão",
};
const payLabel = (m: string) => PAYMENT_LABELS[m] ?? m;

/** Número no formato brasileiro "1234,56" (para o Excel pt-BR interpretar). */
const n2 = (v: number) => Number(v).toFixed(2).replace(".", ",");

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Exporta para CSV (separador ";", BOM UTF-8) — abre direto no Excel pt-BR. */
export function exportReportCsv(d: ReportData, label: string, fileBase: string) {
  const rows: string[][] = [];
  rows.push([`Relatório — ${label}`]);
  rows.push([]);
  rows.push(["Indicador", "Valor"]);
  rows.push(["Faturamento", n2(d.faturamento)]);
  rows.push(["Despesas", n2(d.despesas)]);
  rows.push(["Líquido", n2(d.liquido)]);
  rows.push(["Ticket médio", n2(d.ticket_medio)]);
  rows.push(["Atendimentos", String(d.atendimentos)]);
  rows.push([]);
  rows.push(["Forma de pagamento", "Total"]);
  for (const p of d.by_payment) rows.push([payLabel(p.method), n2(p.total)]);
  rows.push([]);
  rows.push(["Serviço", "Qtd", "Receita"]);
  for (const s of d.services) rows.push([s.name, String(s.qty), n2(s.total)]);
  rows.push([]);
  rows.push(["Profissional", "Atendimentos", "Receita", "Comissão"]);
  for (const p of d.professionals) rows.push([p.name, String(p.qty), n2(p.revenue), n2(p.commission)]);
  rows.push([]);
  rows.push(["Faturamento por dia"]);
  rows.push(["Data", "Total"]);
  for (const x of d.daily) rows.push([x.day, n2(x.total)]);

  const esc = (c: string) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const csv = rows.map((r) => r.map(esc).join(";")).join("\r\n");
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), `${fileBase}.csv`);
}

/** Exporta para PDF (jspdf carregado sob demanda). */
export async function exportReportPdf(d: ReportData, label: string, fileBase: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const marginX = 14;

  doc.setFontSize(16);
  doc.text("Relatório", marginX, 18);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(label, marginX, 25);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    head: [["Indicador", "Valor"]],
    body: [
      ["Faturamento", formatBRL(d.faturamento)],
      ["Despesas", formatBRL(d.despesas)],
      ["Líquido", formatBRL(d.liquido)],
      ["Ticket médio", formatBRL(d.ticket_medio)],
      ["Atendimentos", String(d.atendimentos)],
    ],
    theme: "striped",
    headStyles: { fillColor: [242, 60, 16] },
  });

  type Doc = typeof doc & { lastAutoTable?: { finalY: number } };
  const after = () => ((doc as Doc).lastAutoTable?.finalY ?? 32) + 8;

  if (d.by_payment.length) {
    autoTable(doc, {
      startY: after(),
      head: [["Forma de pagamento", "Total"]],
      body: d.by_payment.map((p) => [payLabel(p.method), formatBRL(p.total)]),
      theme: "striped",
      headStyles: { fillColor: [242, 60, 16] },
    });
  }
  if (d.services.length) {
    autoTable(doc, {
      startY: after(),
      head: [["Serviço", "Qtd", "Receita"]],
      body: d.services.map((s) => [s.name, String(s.qty), formatBRL(s.total)]),
      theme: "striped",
      headStyles: { fillColor: [242, 60, 16] },
    });
  }
  if (d.professionals.length) {
    autoTable(doc, {
      startY: after(),
      head: [["Profissional", "Atend.", "Receita", "Comissão"]],
      body: d.professionals.map((p) => [p.name, String(p.qty), formatBRL(p.revenue), formatBRL(p.commission)]),
      theme: "striped",
      headStyles: { fillColor: [242, 60, 16] },
    });
  }

  doc.save(`${fileBase}.pdf`);
}
