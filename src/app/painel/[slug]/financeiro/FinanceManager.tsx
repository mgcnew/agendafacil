"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, formatTime, formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  Wallet, Loader2, TrendingUp, TrendingDown, Lock, Unlock, Percent, Plus,
  Banknote, Smartphone, CreditCard, History, X, ChevronLeft, ChevronRight, Check,
  Receipt, MessageCircle, Download,
} from "lucide-react";
import {
  generateReceiptPdf, buildReceiptText, payLabel,
  type ReceiptData, type SalonInfo,
} from "./receipt";

type Session = Tables<"cash_sessions">;
type Tx = Tables<"cash_transactions">;
type Comm = { member_id: string; name: string; earned: number; paid: number };
type Period = { label: string; prevCmes: string; nextCmes: string; start: string; end: string };
export type Receivable = { id: string; client: string; member_id: string; total: number; time: string; services: string[] };

const PAY_META: Record<string, { label: string; icon: React.ElementType }> = {
  dinheiro: { label: "Dinheiro", icon: Banknote },
  pix: { label: "Pix", icon: Smartphone },
  cartao: { label: "Cartão", icon: CreditCard },
};

export function FinanceManager({
  salonId,
  canManage,
  openSession,
  transactions,
  commissions,
  closedSessions,
  receivable,
  salon,
  initialTab,
  period,
}: {
  salonId: string;
  canManage: boolean;
  openSession: Session | null;
  transactions: Tx[];
  commissions: Comm[];
  closedSessions: Session[];
  receivable: Receivable[];
  salon: SalonInfo;
  initialTab: "caixa" | "comissoes";
  period: Period;
}) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<"caixa" | "comissoes">(initialTab);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function payCommission(c: Comm, outstanding: number) {
    if (!confirm(`Pagar ${formatBRL(outstanding)} de comissão para ${c.name}?`)) return;
    setPayingId(c.member_id);
    setErr(null);
    const { error } = await supabase.rpc("pay_commission", {
      p_salon: salonId,
      p_member: c.member_id,
      p_amount: outstanding,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    setPayingId(null);
    if (error) { setErr("Não foi possível registrar o pagamento da comissão. Tente novamente."); return; }
    router.refresh();
  }
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("0");
  const [closing, setClosing] = useState(false);

  // form transação
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [method, setMethod] = useState("dinheiro");
  const [selectedAppt, setSelectedAppt] = useState(""); // recebimento vinculado a um atendimento
  const [receiptTx, setReceiptTx] = useState<Tx | null>(null); // cupom não fiscal aberto

  const income = transactions.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const opening0 = openSession ? Number(openSession.opening_amount) : 0;
  const balance = opening0 + income - expense;

  // totais por forma de pagamento (entradas)
  const sumBy = (t: "income" | "expense", m: string) =>
    transactions.filter((x) => x.type === t && (x.payment_method ?? "dinheiro") === m).reduce((a, x) => a + Number(x.amount), 0);
  const incomeByMethod = { dinheiro: sumBy("income", "dinheiro"), pix: sumBy("income", "pix"), cartao: sumBy("income", "cartao") };
  // dinheiro físico esperado na gaveta = abertura + entradas$ - saídas$ (só dinheiro)
  const expectedCash = opening0 + incomeByMethod.dinheiro - sumBy("expense", "dinheiro");

  async function openCash() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("cash_sessions").insert({
      salon_id: salonId,
      opening_amount: parseFloat(opening.replace(",", ".")) || 0,
    });
    setBusy(false);
    if (error) { setErr("Não foi possível abrir o caixa. Tente novamente."); return; }
    router.refresh();
  }

  async function addTx() {
    if (!openSession) return;
    setBusy(true);
    setErr(null);

    // Recebimento de um atendimento → finaliza (lança entrada + comissão + estoque)
    if (type === "income" && selectedAppt) {
      const { error } = await supabase.rpc("finalize_appointment", {
        p_appointment: selectedAppt,
        p_payment_method: method,
      });
      setBusy(false);
      if (error) { setErr("Não foi possível registrar o recebimento. Tente novamente."); return; }
      setSelectedAppt(""); setAmount(""); setDesc("");
      router.refresh();
      return;
    }

    if (!amount) { setBusy(false); return; }
    const { error } = await supabase.from("cash_transactions").insert({
      salon_id: salonId,
      session_id: openSession.id,
      type,
      amount: parseFloat(amount.replace(",", ".")) || 0,
      description: desc || null,
      payment_method: method,
    });
    setBusy(false);
    if (error) { setErr("Não foi possível registrar o lançamento. Tente novamente."); return; }
    setAmount(""); setDesc("");
    router.refresh();
  }

  return (
    <div className="space-y-6 af-rise">
      <div>
        <h1 className="font-display text-2xl font-bold">Caixa & Comissões</h1>
        <p className="text-muted-foreground text-sm">Controle financeiro do salão.</p>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <X className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {(["caixa", "comissoes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "caixa" ? "Caixa" : "Comissões"}
          </button>
        ))}
      </div>

      {tab === "caixa" && (
        <div className="space-y-5">
          {!openSession ? (
            <Card className="p-6">
              <Wallet className="h-8 w-8 text-primary" />
              <h2 className="font-display text-lg font-semibold mt-3">Caixa fechado</h2>
              <p className="text-sm text-muted-foreground mt-1">Abra o caixa para registrar movimentações.</p>
              {canManage && (
                <div className="flex items-end gap-3 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="op">Valor de abertura (R$)</Label>
                    <Input id="op" value={opening} onChange={(e) => setOpening(e.target.value)} className="w-40" />
                  </div>
                  <Button onClick={openCash} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} <Unlock className="h-4 w-4" /> Abrir caixa
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={Wallet} label="Movimento total" value={formatBRL(balance)} />
                <Stat icon={TrendingUp} label="Entradas" value={formatBRL(income)} />
                <Stat icon={TrendingDown} label="Saídas" value={formatBRL(expense)} />
                <Stat icon={Banknote} label="Esperado na gaveta" value={formatBRL(expectedCash)} />
              </div>

              {/* Entradas por forma de pagamento */}
              <div className="grid grid-cols-3 gap-3">
                {(["dinheiro", "pix", "cartao"] as const).map((m) => {
                  const Meta = PAY_META[m];
                  return (
                    <div key={m} className="rounded-[var(--radius)] border border-border bg-card p-3.5">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Meta.icon className="h-3.5 w-3.5" /> {Meta.label}
                      </span>
                      <p className="font-display text-base font-bold mt-1">{formatBRL(incomeByMethod[m])}</p>
                    </div>
                  );
                })}
              </div>

              {canManage && (
                <Card className="p-6 space-y-4">
                  <h3 className="font-display font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Nova movimentação</h3>

                  {/* Receber de uma cliente (atendimentos a receber hoje) */}
                  {type === "income" && receivable.length > 0 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="receber">Receber de uma cliente ({receivable.length} a receber)</Label>
                      <Select
                        id="receber"
                        value={selectedAppt}
                        onValueChange={(v) => {
                          setSelectedAppt(v);
                          const r = receivable.find((x) => x.id === v);
                          if (r) {
                            setAmount(String(Number(r.total)).replace(".", ","));
                            setDesc(`Atendimento · ${r.client}`);
                          } else {
                            setAmount(""); setDesc("");
                          }
                        }}
                      >
                        <option value="">Lançamento avulso</option>
                        {receivable.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.time} · {r.client} · {formatBRL(Number(r.total))}
                          </option>
                        ))}
                      </Select>
                      {selectedAppt && (
                        <p className="text-xs text-muted-foreground">
                          Ao lançar, o atendimento é finalizado — comissão e baixa de estoque são lançadas automaticamente.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-4 gap-3">
                    <Select value={type} onValueChange={(v) => { setType(v as "income" | "expense"); if (v === "expense") { setSelectedAppt(""); } }}>
                      <option value="income">Entrada</option>
                      <option value="expense">Saída</option>
                    </Select>
                    <Input placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!!selectedAppt} />
                    <Select value={method} onValueChange={setMethod}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartão</option>
                    </Select>
                    <Input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!!selectedAppt} />
                  </div>
                  <div className="flex justify-between items-center">
                    <Button onClick={addTx} disabled={busy || (!amount && !selectedAppt)}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {selectedAppt ? "Receber" : "Lançar"}
                    </Button>
                    <Button variant="outline" onClick={() => setClosing(true)}>
                      <Lock className="h-4 w-4" /> Fechar caixa
                    </Button>
                  </div>
                </Card>
              )}

              <div>
                <h3 className="font-display font-semibold mb-3">Movimentações de hoje</h3>
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-[var(--radius)]">
                    Nenhuma movimentação ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5">
                        <span className={`grid place-items-center h-9 w-9 rounded-full ${t.type === "income" ? "bg-emerald-500/12 text-emerald-600" : "bg-red-500/12 text-red-600"}`}>
                          {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.description || (t.type === "income" ? "Entrada" : "Saída")}</p>
                          <p className="text-xs text-muted-foreground">{t.payment_method} · {formatTime(t.created_at)}</p>
                        </div>
                        <span className={`font-semibold text-sm ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                          {t.type === "income" ? "+" : "-"}{formatBRL(Number(t.amount))}
                        </span>
                        {t.type === "income" && (
                          <button
                            onClick={() => setReceiptTx(t)}
                            title="Emitir cupom"
                            className="shrink-0 grid place-items-center h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Receipt className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Histórico de sessões fechadas */}
          {closedSessions.length > 0 && (
            <div>
              <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Caixas anteriores
              </h3>
              <div className="space-y-2">
                {closedSessions.map((s) => {
                  const diff = s.difference == null ? null : Number(s.difference);
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {s.closed_at ? new Date(s.closed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Abertura {formatBRL(Number(s.opening_amount))}
                          {s.expected_amount != null && <> · Esperado {formatBRL(Number(s.expected_amount))}</>}
                          {s.closing_amount != null && <> · Contado {formatBRL(Number(s.closing_amount))}</>}
                        </p>
                      </div>
                      {diff != null && (
                        <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                          diff === 0 ? "bg-muted text-muted-foreground"
                          : diff > 0 ? "bg-emerald-500/12 text-emerald-600"
                          : "bg-red-500/12 text-red-600"
                        }`}>
                          {diff === 0 ? "Conferido" : `${diff > 0 ? "Sobra" : "Falta"} ${formatBRL(Math.abs(diff))}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de fechamento com conferência */}
      <AnimatePresence>
        {closing && openSession && (
          <CloseModal
            key="close"
            expectedCash={expectedCash}
            incomeByMethod={incomeByMethod}
            onClose={() => setClosing(false)}
            onConfirm={async (counted) => {
              const { error } = await supabase
                .from("cash_sessions")
                .update({
                  closed_at: new Date().toISOString(),
                  closing_amount: counted,
                  expected_amount: expectedCash,
                  difference: counted - expectedCash,
                })
                .eq("id", openSession.id);
              if (error) { setErr("Não foi possível fechar o caixa. Tente novamente."); return; }
              setClosing(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Cupom não fiscal */}
      <AnimatePresence>
        {receiptTx && (
          <ReceiptModal key="receipt" tx={receiptTx} salon={salon} onClose={() => setReceiptTx(null)} />
        )}
      </AnimatePresence>

      {tab === "comissoes" && (
        <div className="space-y-4">
          {/* Navegação de período */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Comissões dos atendimentos concluídos no período.
            </p>
            <div className="flex items-center gap-1">
              <Link
                href={`${pathname}?tab=comissoes&cmes=${period.prevCmes}`}
                className="h-9 w-9 flex items-center justify-center rounded-[var(--radius)] border border-border hover:bg-muted transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="text-sm font-medium px-2 min-w-[120px] text-center capitalize">{period.label}</span>
              <Link
                href={`${pathname}?tab=comissoes&cmes=${period.nextCmes}`}
                className="h-9 w-9 flex items-center justify-center rounded-[var(--radius)] border border-border hover:bg-muted transition"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {commissions.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
              <Percent className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3">Nenhuma comissão apurada no período.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map((c) => {
                const outstanding = Math.max(0, c.earned - c.paid);
                const settled = outstanding < 0.01;
                return (
                  <div key={c.member_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Apurado {formatBRL(c.earned)}
                        {c.paid > 0 && <> · Pago {formatBRL(c.paid)}</>}
                      </p>
                    </div>
                    {settled ? (
                      <span className="text-xs font-medium rounded-full bg-emerald-500/12 text-emerald-600 px-2.5 py-1 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Pago
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold text-primary text-sm">{formatBRL(outstanding)}</span>
                        {canManage && (
                          <Button size="sm" onClick={() => payCommission(c, outstanding)} disabled={payingId === c.member_id}>
                            {payingId === c.member_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pagar"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Ao pagar, o valor entra como saída no caixa (se aberto).
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="font-display text-lg font-bold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Fechamento de caixa com conferência ──────────────────────────
/* ─────────────────── Cupom não fiscal ─────────────────── */
function ReceiptModal({ tx, salon, onClose }: { tx: Tx; salon: SalonInfo; onClose: () => void }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReceiptData | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);

  useEffect(() => {
    (async () => {
      let items: { name: string; price: number }[] = [];
      let client: string | null = null;
      let phone: string | null = null;
      if (tx.appointment_id) {
        const [{ data: svcs }, { data: appt }] = await Promise.all([
          supabase.from("appointment_services").select("name, price").eq("appointment_id", tx.appointment_id),
          supabase.from("appointments").select("clients(full_name, phone)").eq("id", tx.appointment_id).maybeSingle(),
        ]);
        items = (svcs ?? []).map((s) => ({ name: s.name, price: Number(s.price) }));
        const c = appt?.clients as { full_name?: string; phone?: string | null } | null;
        client = c?.full_name ?? null;
        phone = c?.phone ?? null;
      }
      setClientPhone(phone);
      setData({
        client,
        dateTime: `${formatDate(tx.created_at)} ${formatTime(tx.created_at)}`,
        items,
        total: Number(tx.amount),
        paymentMethod: tx.payment_method ?? "dinheiro",
        fileBase: `comprovante-${(client ?? "cliente").toLowerCase().replace(/\s+/g, "-")}-${tx.id.slice(0, 8)}`,
      });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadPdf() {
    if (!data) return;
    setBusyPdf(true);
    try { await generateReceiptPdf(data, salon); } finally { setBusyPdf(false); }
  }

  const waHref = (() => {
    if (!data || !clientPhone) return null;
    const digits = clientPhone.replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(buildReceiptText(data, salon))}`;
  })();

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Cupom não fiscal
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {loading || !data ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="rounded-[var(--radius)] border border-border p-4 text-sm space-y-1">
              <p className="font-display font-bold">{salon.name}</p>
              {(salon.phone || salon.address) && (
                <p className="text-xs text-muted-foreground">{[salon.phone, salon.address].filter(Boolean).join(" · ")}</p>
              )}
              <p className="text-xs text-muted-foreground pt-1">{data.dateTime}{data.client ? ` · ${data.client}` : ""}</p>
              <div className="border-t border-border my-2" />
              {data.items.length ? data.items.map((i, idx) => (
                <div key={idx} className="flex justify-between gap-3"><span className="min-w-0 truncate">{i.name}</span><span className="shrink-0">{formatBRL(i.price)}</span></div>
              )) : (
                <div className="flex justify-between gap-3"><span className="min-w-0 truncate">{tx.description || "Recebimento"}</span><span className="shrink-0">{formatBRL(data.total)}</span></div>
              )}
              <div className="border-t border-border my-2" />
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatBRL(data.total)}</span></div>
              <p className="text-xs text-muted-foreground">Pagamento: {payLabel(data.paymentMethod)}</p>
              <p className="text-[10px] text-muted-foreground pt-2">Documento sem valor fiscal</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={downloadPdf} disabled={busyPdf} className="flex-1">
                {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
              </Button>
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-[var(--radius)] bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
            {!clientPhone && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Sem telefone da cliente para o WhatsApp — baixe o PDF e anexe na conversa.
              </p>
            )}
          </>
        )}
      </Card>
    </MotionModal>
  );
}

function CloseModal({
  expectedCash,
  incomeByMethod,
  onClose,
  onConfirm,
}: {
  expectedCash: number;
  incomeByMethod: { dinheiro: number; pix: number; cartao: number };
  onClose: () => void;
  onConfirm: (counted: number) => Promise<void>;
}) {
  const [counted, setCounted] = useState("");
  const [busy, setBusy] = useState(false);
  const countedNum = parseFloat(counted.replace(",", ".")) || 0;
  const diff = countedNum - expectedCash;

  async function confirm() {
    setBusy(true);
    await onConfirm(countedNum);
    setBusy(false);
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Fechar caixa
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          Confira o dinheiro na gaveta. Pix e cartão não contam (vão para a conta).
        </p>

        {/* Totais por forma */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {(["dinheiro", "pix", "cartao"] as const).map((m) => {
            const Meta = PAY_META[m];
            return (
              <div key={m} className="rounded-[var(--radius)] bg-muted px-2.5 py-2 text-center">
                <Meta.icon className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                <p className="text-xs font-semibold mt-1">{formatBRL(incomeByMethod[m])}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-[var(--radius)] bg-muted px-4 py-3 mt-4">
          <span className="text-sm text-muted-foreground">Esperado na gaveta</span>
          <span className="font-display text-lg font-bold">{formatBRL(expectedCash)}</span>
        </div>

        <div className="space-y-1.5 mt-4">
          <Label htmlFor="counted">Valor contado (R$)</Label>
          <Input id="counted" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0,00" />
        </div>

        {counted !== "" && (
          <div className={`flex items-center justify-between rounded-[var(--radius)] px-4 py-3 mt-3 text-sm font-semibold ${
            Math.abs(diff) < 0.01 ? "bg-emerald-500/12 text-emerald-600"
            : diff > 0 ? "bg-emerald-500/12 text-emerald-600"
            : "bg-red-500/12 text-red-600"
          }`}>
            <span>{Math.abs(diff) < 0.01 ? "Caixa conferido" : diff > 0 ? "Sobra" : "Falta"}</span>
            <span>{Math.abs(diff) < 0.01 ? "✓" : formatBRL(Math.abs(diff))}</span>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <Button onClick={confirm} disabled={busy || counted === ""} className="flex-1">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar fechamento
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </MotionModal>
  );
}
