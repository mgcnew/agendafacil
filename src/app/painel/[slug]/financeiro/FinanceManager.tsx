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
  Receipt, MessageCircle, Download, UsersRound, Boxes, Minus, Search, BarChart2,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, AlertTriangle,
} from "lucide-react";
import {
  generateReceiptPdf, buildReceiptText, payLabel,
  generateCommissionPdf, buildCommissionText,
  generateClosingReportPdf, buildClosingReportText,
  type ReceiptData, type SalonInfo, type CommissionLine, type CommissionReceiptData, type ClosingReportData,
} from "./receipt";
import { FixedCostsPanel, type FixedCost, type ChairRental, type ActivePackageSummary } from "./FixedCostsPanel";

type Session = Tables<"cash_sessions">;
type Tx = Tables<"cash_transactions">;
type Comm = { member_id: string; name: string; earned: number; paid: number };
type Period = { label: string; prevCmes: string; nextCmes: string; start: string; end: string; startIso: string; endIso: string };
export type Receivable = { id: string; client: string; member_id: string; total: number; time: string; services: string[] };
export type ResaleProduct = { id: string; name: string; sale_price: number; quantity: number };

const PAY_META: Record<string, { label: string; icon: React.ElementType }> = {
  dinheiro: { label: "Dinheiro", icon: Banknote },
  pix: { label: "Pix", icon: Smartphone },
  debito: { label: "Débito", icon: CreditCard },
  credito: { label: "Crédito", icon: CreditCard },
  cartao: { label: "Cartão", icon: CreditCard }, // legado — exibição de dados antigos
};

const PICKER_METHODS = ["dinheiro", "pix", "debito", "credito"] as const;

export function FinanceManager({
  salonId,
  canManage,
  openSession,
  transactions,
  commissions,
  closedSessions,
  receivable,
  resaleProducts,
  canDiscount,
  maxDiscountPercent,
  salon,
  initialTab,
  period,
  fixedCosts,
  chairRentals,
  activePackages,
}: {
  salonId: string;
  canManage: boolean;
  openSession: Session | null;
  transactions: Tx[];
  commissions: Comm[];
  closedSessions: Session[];
  receivable: Receivable[];
  resaleProducts: ResaleProduct[];
  canDiscount: boolean;
  maxDiscountPercent: number;
  salon: SalonInfo;
  initialTab: "caixa" | "comissoes" | "fixos";
  period: Period;
  fixedCosts: FixedCost[];
  chairRentals: ChairRental[];
  activePackages: ActivePackageSummary;
}) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<"caixa" | "comissoes" | "fixos">(initialTab);
  const [commModal, setCommModal] = useState<Comm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("0");
  const [closing, setClosing] = useState(false);

  const [receiptTx, setReceiptTx] = useState<Tx | null>(null); // cupom não fiscal aberto
  const [charging, setCharging] = useState<Receivable | null>(null); // cobrança de cliente
  const [selling, setSelling] = useState<ResaleProduct | null>(null); // venda de produto
  const [receberOpen, setReceberOpen] = useState(false); // lista de recebíveis (expande no lugar)
  const [lojaOpen, setLojaOpen] = useState(false); // modal da loja (venda de produto)
  const [manualModal, setManualModal] = useState(false); // modal de lançamento manual
  const [movementsModal, setMovementsModal] = useState(false); // modal "ver todas" as movimentações
  const [selectedSession, setSelectedSession] = useState<Session | null>(null); // relatório de sessão fechada
  const [reverseTx, setReverseTx] = useState<Tx | null>(null); // confirmação de estorno
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  // Estorna uma movimentação (cobrança de atendimento volta para "Receber"; avulso é removido).
  async function reverseTransaction(t: Tx) {
    const { error } = await supabase.rpc("reverse_cash_transaction" as never, { p_tx: t.id } as never);
    if (error) throw error;
    router.refresh();
  }

  // Cobra um atendimento do dia com a forma de pagamento (e desconto/splits) escolhidos.
  async function chargeAppointment(
    apptId: string,
    payment: string,
    discount: number,
    splits?: { method: string; amount: number }[],
  ) {
    const params: Record<string, unknown> = {
      p_appointment: apptId,
      p_discount: discount || 0,
    };
    if (splits && splits.length > 1) {
      params.p_splits = splits;
    } else {
      params.p_payment_method = payment;
    }
    const { error } = await supabase.rpc("finalize_appointment" as never, params as never);
    if (error) throw error;
    router.refresh();
  }

  // Vende um produto de revenda (entrada + baixa de estoque, sem comissão).
  async function sellProduct(productId: string, qty: number, payment: string) {
    if (!openSession) throw new Error("Caixa fechado.");
    const { error } = await supabase.rpc("cash_sell_product" as never, {
      p_session: openSession.id,
      p_product: productId,
      p_qty: qty,
      p_payment_method: payment,
    } as never);
    if (error) throw error;
    router.refresh();
  }

  const opening0 = openSession ? Number(openSession.opening_amount) : 0;

  // Sangria/Suprimento movem dinheiro físico mas NÃO são receita/despesa: ficam fora do resultado.
  const isCashMove = (x: Tx) => x.category === "sangria" || x.category === "suprimento";

  // totais por forma de pagamento (entradas reais — exclui movimentações de gaveta)
  const sumBy = (t: "income" | "expense", m: string) =>
    transactions.filter((x) => x.type === t && !isCashMove(x) && (x.payment_method ?? "dinheiro") === m).reduce((a, x) => a + Number(x.amount), 0);
  const incomeByMethod = {
    dinheiro: sumBy("income", "dinheiro"),
    pix: sumBy("income", "pix"),
    debito: sumBy("income", "debito"),
    credito: sumBy("income", "credito"),
    cartao: sumBy("income", "cartao"), // legado
  };
  const totalIncome = transactions.filter((x) => x.type === "income" && !isCashMove(x)).reduce((a, x) => a + Number(x.amount), 0);
  const totalExpense = transactions.filter((x) => x.type === "expense" && !isCashMove(x)).reduce((a, x) => a + Number(x.amount), 0);

  // movimentações de gaveta (afetam só o dinheiro físico)
  const suprimentoTotal = transactions.filter((x) => x.category === "suprimento").reduce((a, x) => a + Number(x.amount), 0);
  const sangriaTotal = transactions.filter((x) => x.category === "sangria").reduce((a, x) => a + Number(x.amount), 0);

  // dinheiro físico esperado na gaveta = abertura + TODAS entradas dinheiro - TODAS saídas dinheiro (inclui sangria/suprimento)
  const cashIn = transactions.filter((x) => x.type === "income" && (x.payment_method ?? "dinheiro") === "dinheiro").reduce((a, x) => a + Number(x.amount), 0);
  const cashOut = transactions.filter((x) => x.type === "expense" && (x.payment_method ?? "dinheiro") === "dinheiro").reduce((a, x) => a + Number(x.amount), 0);
  const expectedCash = opening0 + cashIn - cashOut;

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

  // Lançamento manual avulso (entrada/saída/sangria/suprimento) — usado pelo ManualModal.
  async function launchManual(t: "income" | "expense", amt: number, m: string, d: string, category?: string) {
    if (!openSession || amt <= 0) return;
    const { error } = await supabase.from("cash_transactions").insert({
      salon_id: salonId,
      session_id: openSession.id,
      type: t,
      amount: amt,
      description: d || null,
      payment_method: m,
      category: category || null,
    });
    if (error) throw error;
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
        {(["caixa", "comissoes", "fixos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "caixa" ? "Caixa" : t === "comissoes" ? "Comissões" : "Fixos"}
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
              {canManage && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <ActionTile icon={UsersRound} label="Receber" badge={receivable.length} active={receberOpen} onClick={() => setReceberOpen((v) => !v)} />
                    <ActionTile icon={Boxes} label="Loja" onClick={() => setLojaOpen(true)} />
                    <ActionTile icon={Plus} label="Lançar" onClick={() => setManualModal(true)} />
                    <ActionTile icon={History} label="Histórico" badge={transactions.length || undefined} onClick={() => setMovementsModal(true)} />
                  </div>

                  {/* Receber: expande no lugar */}
                  {receberOpen && (
                    <Card className="p-4">
                      {receivable.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-3 text-center">Nenhum cliente a receber agora.</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-auto">
                          {receivable.map((r) => (
                            <button key={r.id} onClick={() => setCharging(r)}
                              className="w-full text-left flex items-center gap-3 rounded-[var(--radius)] border border-border p-3 hover:bg-muted/40 transition">
                              <span className="font-display font-bold tabular-nums text-sm w-12 shrink-0">{r.time}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{r.client}</p>
                                {r.services.length > 0 && <p className="text-xs text-muted-foreground truncate">{r.services.join(", ")}</p>}
                              </div>
                              <span className="text-sm font-semibold text-primary shrink-0">{formatBRL(Number(r.total))}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}

                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setClosing(true)}>
                      <Lock className="h-4 w-4" /> Fechar caixa
                    </Button>
                  </div>
                </>
              )}
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
                    <button
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className="w-full text-left flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5 hover:bg-muted/40 transition"
                    >
                      <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
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
                        <span className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${
                          diff === 0 ? "bg-muted text-muted-foreground"
                          : diff > 0 ? "bg-emerald-500/12 text-emerald-600"
                          : "bg-red-500/12 text-red-600"
                        }`}>
                          {diff === 0 ? "Conferido" : `${diff > 0 ? "Sobra" : "Falta"} ${formatBRL(Math.abs(diff))}`}
                        </span>
                      )}
                    </button>
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
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            openingAmount={opening0}
            suprimentoTotal={suprimentoTotal}
            sangriaTotal={sangriaTotal}
            salon={salon}
            onClose={() => { setClosing(false); router.refresh(); }}
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
              if (error) return false;
              return true;
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

      {/* Cobrar cliente (escolha da forma de pagamento) */}
      <AnimatePresence>
        {charging && (
          <PaymentPickerModal
            key="charge"
            title={charging.client}
            subtitle={charging.services.join(", ")}
            total={Number(charging.total)}
            confirmLabel="Receber"
            allowDiscount={canDiscount}
            maxDiscountPercent={maxDiscountPercent}
            allowSplit
            onClose={() => setCharging(null)}
            onConfirm={async (pay, discount, splits) => { await chargeAppointment(charging.id, pay, discount, splits); showToast(`✓ ${formatBRL(Number(charging.total))} recebido de ${charging.client}`); setCharging(null); }}
          />
        )}
      </AnimatePresence>

      {/* Vender produto (quantidade + forma de pagamento) */}
      <AnimatePresence>
        {selling && (
          <SellProductModal
            key="sell"
            product={selling}
            onClose={() => setSelling(null)}
            onConfirm={async (qty, pay) => { await sellProduct(selling.id, qty, pay); showToast(`✓ ${selling.name} vendido`); setSelling(null); }}
          />
        )}
      </AnimatePresence>

      {/* Loja (venda de produto com busca) */}
      <AnimatePresence>
        {lojaOpen && (
          <LojaModal
            key="loja"
            products={resaleProducts}
            onPick={(p) => { setLojaOpen(false); setSelling(p); }}
            onClose={() => setLojaOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Lançamento manual */}
      <AnimatePresence>
        {manualModal && (
          <ManualModal
            key="manual"
            onClose={() => setManualModal(false)}
            onLaunch={launchManual}
          />
        )}
      </AnimatePresence>

      {/* Todas as movimentações */}
      <AnimatePresence>
        {movementsModal && (
          <MovementsModal
            key="movs"
            transactions={transactions}
            onReceipt={(t) => { setMovementsModal(false); setReceiptTx(t); }}
            onReverse={canManage ? (t) => { setMovementsModal(false); setReverseTx(t); } : undefined}
            onClose={() => setMovementsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Confirmação de estorno */}
      <AnimatePresence>
        {reverseTx && (
          <ReverseModal
            key="reverse"
            tx={reverseTx}
            onClose={() => setReverseTx(null)}
            onConfirm={async () => {
              await reverseTransaction(reverseTx);
              showToast("✓ Movimentação estornada");
              setReverseTx(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Relatório de sessão fechada */}
      <AnimatePresence>
        {selectedSession && (
          <SessionDetailModal
            key="session-detail"
            session={selectedSession}
            salon={salon}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>

      {/* Detalhe / pagamento de comissão */}
      <AnimatePresence>
        {commModal && (
          <CommissionModal
            key="comm"
            salonId={salonId}
            comm={commModal}
            period={period}
            salon={salon}
            canManage={canManage}
            onClose={() => setCommModal(null)}
            onPaid={() => { setCommModal(null); router.refresh(); }}
          />
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
                  <button
                    key={c.member_id}
                    onClick={() => setCommModal(c)}
                    className="w-full text-left flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-4 hover:bg-muted/40 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Apurado {formatBRL(c.earned)}
                        {c.paid > 0 && <> · Pago {formatBRL(c.paid)}</>}
                      </p>
                    </div>
                    {settled ? (
                      <span className="text-xs font-medium rounded-full bg-emerald-500/12 text-emerald-600 px-2.5 py-1 flex items-center gap-1 shrink-0">
                        <Check className="h-3.5 w-3.5" /> Pago
                      </span>
                    ) : (
                      <span className="font-semibold text-primary text-sm shrink-0">{formatBRL(outstanding)}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Toque em um profissional para ver o detalhe por serviço, gerar comprovante e pagar. Ao pagar, o valor entra como saída no caixa (se aberto).
          </p>
        </div>
      )}

      {tab === "fixos" && (
        <FixedCostsPanel
          salonId={salonId}
          fixedCosts={fixedCosts}
          chairRentals={chairRentals}
          activePackages={activePackages}
        />
      )}

      {/* Toast de sucesso */}
      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lg whitespace-nowrap">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" /> {toast}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────── Caixa: tiles de ação, linha de movimentação e modais ─────────── */
function ActionTile({
  icon: Icon, label, badge, active, onClick,
}: { icon: React.ElementType; label: string; badge?: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] border p-4 transition ${
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/20"
      }`}
    >
      {badge != null && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground min-w-[18px] h-[18px] px-1 grid place-items-center">{badge}</span>
      )}
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function TxRow({ t, onReceipt, onReverse }: { t: Tx; onReceipt?: () => void; onReverse?: () => void }) {
  const isCashMove = t.category === "sangria" || t.category === "suprimento";
  const Icon = t.category === "sangria" ? ArrowUpFromLine
    : t.category === "suprimento" ? ArrowDownToLine
    : t.type === "income" ? TrendingUp : TrendingDown;
  const subtitle = isCashMove
    ? `${t.category === "sangria" ? "Sangria" : "Suprimento"} · ${formatTime(t.created_at)}`
    : `${PAY_META[t.payment_method ?? "dinheiro"]?.label ?? (t.payment_method ?? "—")} · ${formatTime(t.created_at)}`;
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5">
      <span className={`grid place-items-center h-9 w-9 rounded-full ${t.type === "income" ? "bg-emerald-500/12 text-emerald-600" : "bg-red-500/12 text-red-600"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{t.description || (t.type === "income" ? "Entrada" : "Saída")}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className={`font-semibold text-sm ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
        {t.type === "income" ? "+" : "-"}{formatBRL(Number(t.amount))}
      </span>
      {t.type === "income" && !isCashMove && onReceipt && (
        <button onClick={onReceipt} title="Emitir cupom"
          className="shrink-0 grid place-items-center h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-muted hover:text-foreground">
          <Receipt className="h-4 w-4" />
        </button>
      )}
      {onReverse && (
        <button onClick={onReverse} title="Estornar"
          className="shrink-0 grid place-items-center h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-red-500/10 hover:text-red-600">
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function LojaModal({
  products, onPick, onClose,
}: { products: ResaleProduct[]; onPick: (p: ResaleProduct) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] flex flex-col p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Loja</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto…" className="pl-9" />
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto de revenda. Cadastre no Estoque marcando &ldquo;para revenda&rdquo;.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nada encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => onPick(p)}
                  className="text-left rounded-[var(--radius)] border border-border p-3 hover:border-primary hover:bg-primary/5 transition">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(Number(p.sale_price))} · {Number(p.quantity)} est.</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </MotionModal>
  );
}

type ManualOp = "suprimento" | "sangria" | "income" | "expense";
const MANUAL_OPS: { key: ManualOp; label: string; hint: string; icon: React.ElementType }[] = [
  { key: "suprimento", label: "Suprimento", hint: "Colocar troco na gaveta", icon: ArrowDownToLine },
  { key: "sangria",    label: "Sangria",    hint: "Retirar dinheiro da gaveta", icon: ArrowUpFromLine },
  { key: "income",     label: "Entrada",    hint: "Outra entrada avulsa", icon: Plus },
  { key: "expense",    label: "Saída",      hint: "Despesa / pagamento", icon: Minus },
];

function ManualModal({
  onClose, onLaunch,
}: { onClose: () => void; onLaunch: (t: "income" | "expense", amt: number, m: string, d: string, category?: string) => Promise<void> }) {
  const [op, setOp] = useState<ManualOp>("suprimento");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("dinheiro");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // sangria/suprimento são sempre em dinheiro físico
  const isCashMove = op === "sangria" || op === "suprimento";
  const txType: "income" | "expense" = op === "suprimento" || op === "income" ? "income" : "expense";
  const category = isCashMove ? op : undefined;
  const current = MANUAL_OPS.find((o) => o.key === op)!;

  async function submit() {
    const amt = parseFloat(amount.replace(",", ".")) || 0;
    if (amt <= 0) return;
    setBusy(true);
    setErr(null);
    try {
      await onLaunch(txType, amt, isCashMove ? "dinheiro" : method, desc || current.label, category);
      onClose();
    } catch {
      setErr("Não foi possível lançar. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Movimentar caixa</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {MANUAL_OPS.map((o) => (
              <button
                key={o.key}
                onClick={() => setOp(o.key)}
                className={`flex flex-col items-start gap-1 rounded-[var(--radius)] border p-3 text-left transition ${
                  op === o.key ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20"
                }`}
              >
                <o.icon className={`h-4 w-4 ${op === o.key ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{o.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{o.hint}</span>
              </button>
            ))}
          </div>

          {!isCashMove && (
            <Select value={method} onValueChange={setMethod}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </Select>
          )}

          <Input placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
          <Input
            placeholder={op === "sangria" ? "Motivo (ex.: depósito no banco)" : op === "suprimento" ? "Origem (ex.: fundo de troco)" : "Descrição (ex.: pagamento de fornecedor)"}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          {isCashMove && (
            <p className="text-[11px] text-muted-foreground">
              {op === "sangria"
                ? "A sangria reduz o dinheiro esperado na gaveta, sem afetar o resultado do dia."
                : "O suprimento aumenta o dinheiro esperado na gaveta, sem afetar o resultado do dia."}
            </p>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={submit} disabled={busy || !amount} className="w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} <current.icon className="h-4 w-4" /> Confirmar {current.label.toLowerCase()}
          </Button>
        </div>
      </Card>
    </MotionModal>
  );
}

function MovementsModal({
  transactions, onReceipt, onReverse, onClose,
}: { transactions: Tx[]; onReceipt: (t: Tx) => void; onReverse?: (t: Tx) => void; onClose: () => void }) {
  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] flex flex-col p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <h3 className="font-display text-lg font-bold">Movimentações de hoje</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-2 overflow-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma movimentação ainda.</p>
          ) : transactions.map((t) => (
            <TxRow key={t.id} t={t} onReceipt={() => onReceipt(t)} onReverse={onReverse ? () => onReverse(t) : undefined} />
          ))}
        </div>
      </Card>
    </MotionModal>
  );
}

function ReverseModal({
  tx, onClose, onConfirm,
}: { tx: Tx; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isCharge = !!tx.appointment_id && tx.type === "income";

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Não foi possível estornar.");
      setBusy(false);
    }
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-sm mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-600" /> Estornar movimentação
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-[var(--radius)] bg-secondary border border-border p-3.5 mt-2">
          <p className="text-sm font-medium truncate">{tx.description || (tx.type === "income" ? "Entrada" : "Saída")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {PAY_META[tx.payment_method ?? "dinheiro"]?.label ?? tx.payment_method} · {formatTime(tx.created_at)}
          </p>
          <p className={`font-display text-xl font-bold mt-1 ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
            {tx.type === "income" ? "+" : "-"}{formatBRL(Number(tx.amount))}
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-[var(--radius)] bg-amber-500/10 text-amber-800 p-3 mt-3 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {isCharge
              ? "A cobrança será desfeita e o atendimento voltará para a lista de “Receber”, pronto para ser cobrado novamente com a forma correta."
              : "Este lançamento será removido do caixa. Esta ação não pode ser desfeita."}
          </span>
        </div>

        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

        <div className="flex gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={confirm} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Estornar
          </Button>
        </div>
      </Card>
    </MotionModal>
  );
}

/* ─────────── Escolha da forma de pagamento (cobrar cliente / vender) ─────────── */
function PaymentPickerModal({
  title, subtitle, total, confirmLabel, extra,
  allowDiscount = false, maxDiscountPercent = 0,
  allowSplit = false,
  onClose, onConfirm,
}: {
  title: string;
  subtitle?: string;
  total: number;
  confirmLabel: string;
  extra?: React.ReactNode;
  allowDiscount?: boolean;
  maxDiscountPercent?: number;
  allowSplit?: boolean;
  onClose: () => void;
  onConfirm: (payment: string, discount: number, splits?: { method: string; amount: number }[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [discMode, setDiscMode] = useState<"percent" | "value">("percent");
  const [discInput, setDiscInput] = useState("");
  const [cashMode, setCashMode] = useState(false);
  const [received, setReceived] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<{ method: string; amount: string }[]>([]);

  const showDiscount = allowDiscount && maxDiscountPercent > 0;
  const maxValue = total * maxDiscountPercent / 100;
  const rawDisc = discMode === "percent"
    ? total * (parseFloat(discInput.replace(",", ".")) || 0) / 100
    : parseFloat(discInput.replace(",", ".")) || 0;
  const discount = showDiscount ? Math.min(Math.max(0, rawDisc), maxValue, total) : 0;
  const net = total - discount;
  const receivedNum = parseFloat(received.replace(",", ".")) || 0;
  const troco = receivedNum - net;

  const splitMethods = splits.map((sp) => sp.method);
  const availableSplitMethods = PICKER_METHODS.filter((m) => !splitMethods.includes(m));
  const splitsTotal = splits.reduce((s, sp) => s + (parseFloat(sp.amount.replace(",", ".")) || 0), 0);
  const splitRemaining = net - splitsTotal;
  const splitReady = splits.length >= 2 && Math.abs(splitRemaining) < 0.01;

  function addSplit(method: string) {
    setSplits((prev) => [...prev, { method, amount: "" }]);
  }
  function removeSplit(i: number) {
    setSplits((prev) => prev.filter((_, j) => j !== i));
  }
  function updateSplitAmount(i: number, amount: string) {
    setSplits((prev) => prev.map((sp, j) => (j === i ? { ...sp, amount } : sp)));
  }

  async function confirm(m: string) {
    setBusy(m);
    setErr(null);
    try {
      await onConfirm(m, discount);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Não foi possível concluir.");
      setBusy(null);
    }
  }

  async function confirmSplits() {
    const parsed = splits
      .map((sp) => ({ method: sp.method, amount: parseFloat(sp.amount.replace(",", ".")) || 0 }))
      .filter((sp) => sp.amount > 0);
    if (parsed.length < 2) return;
    setBusy("split");
    setErr(null);
    try {
      await onConfirm("split", discount, parsed);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Não foi possível concluir.");
      setBusy(null);
    }
  }

  function pick(m: string) {
    if (m === "dinheiro") { setCashMode(true); return; }
    confirm(m);
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-sm mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold truncate">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0"><X className="h-5 w-5" /></button>
        </div>
        {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
        {extra}

        {showDiscount && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Desconto</Label>
              <div className="inline-flex rounded-[var(--radius)] border border-border p-0.5">
                {(["percent", "value"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDiscMode(mode)}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-[calc(var(--radius)-0.2rem)] transition ${
                      discMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {mode === "percent" ? "%" : "R$"}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={discInput}
              onChange={(e) => setDiscInput(e.target.value)}
              inputMode="decimal"
              placeholder={discMode === "percent" ? "0" : "0,00"}
            />
            <p className="text-[11px] text-muted-foreground">
              Máx {maxDiscountPercent}% ({formatBRL(maxValue)}){discount > 0 ? ` · aplicado −${formatBRL(discount)}` : ""}
            </p>
          </div>
        )}

        <div className="flex items-baseline justify-between rounded-[var(--radius)] bg-secondary border border-border px-4 py-3 mt-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-2xl font-bold">
            {discount > 0 && <span className="line-through text-muted-foreground text-base font-normal mr-2">{formatBRL(total)}</span>}
            {formatBRL(net)}
          </span>
        </div>
        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

        {/* ── modo split ── */}
        {splitMode ? (
          <div className="mt-4 space-y-3">
            <button
              onClick={() => { setSplitMode(false); setSplits([]); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> voltar
            </button>

            {availableSplitMethods.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Adicionar forma:</p>
                <div className="flex gap-2 flex-wrap">
                  {availableSplitMethods.map((m) => {
                    const Meta = PAY_META[m];
                    return (
                      <button
                        key={m}
                        onClick={() => addSplit(m)}
                        className="flex items-center gap-1.5 text-xs border border-border rounded-[var(--radius)] px-3 py-1.5 hover:border-primary hover:bg-primary/5 transition"
                      >
                        <Meta.icon className="h-3.5 w-3.5 text-primary" /> + {Meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {splits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Adicione ao menos duas formas de pagamento.</p>
            ) : (
              <div className="space-y-2">
                {splits.map((sp, i) => {
                  const Meta = PAY_META[sp.method];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        <Meta.icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{Meta.label}</span>
                      </div>
                      <Input
                        value={sp.amount}
                        onChange={(e) => updateSplitAmount(i, e.target.value)}
                        inputMode="decimal"
                        placeholder="0,00"
                        className="flex-1"
                      />
                      <button
                        onClick={() => removeSplit(i)}
                        className="h-9 w-9 grid place-items-center rounded-[var(--radius)] hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {splits.length > 0 && (
              <div className={`flex items-center justify-between rounded-[var(--radius)] px-4 py-3 text-sm font-semibold ${
                Math.abs(splitRemaining) < 0.01
                  ? "bg-emerald-500/12 text-emerald-600"
                  : splitRemaining > 0
                  ? "bg-amber-500/12 text-amber-700"
                  : "bg-red-500/12 text-red-600"
              }`}>
                <span>{Math.abs(splitRemaining) < 0.01 ? "Divisão completa" : splitRemaining > 0 ? "Falta" : "Excede"}</span>
                <span className="font-display text-base">
                  {Math.abs(splitRemaining) < 0.01 ? "✓" : formatBRL(Math.abs(splitRemaining))}
                </span>
              </div>
            )}

            <Button onClick={confirmSplits} disabled={busy !== null || !splitReady} className="w-full">
              {busy === "split" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar divisão
            </Button>
          </div>

        ) : cashMode ? (
          /* ── sub-etapa dinheiro: troco ── */
          <div className="mt-4 space-y-3">
            <button onClick={() => { setCashMode(false); setReceived(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> outras formas
            </button>
            <div className="space-y-1.5">
              <Label htmlFor="received">Valor recebido (R$)</Label>
              <Input id="received" autoFocus value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" placeholder={formatBRL(net)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[net, 50, 100, 200].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setReceived(v === net ? net.toFixed(2).replace(".", ",") : String(v))}
                  className="flex-1 min-w-[4rem] rounded-[var(--radius)] border border-border px-2 py-1.5 text-xs font-medium hover:border-primary hover:bg-primary/5 transition"
                >
                  {v === net ? "Exato" : formatBRL(v)}
                </button>
              ))}
            </div>
            {received !== "" && (
              <div className={`flex items-center justify-between rounded-[var(--radius)] px-4 py-3 text-sm font-semibold ${
                troco < 0 ? "bg-red-50 text-red-700" : "bg-emerald-500/12 text-emerald-600"
              }`}>
                <span>{troco < 0 ? "Falta" : "Troco"}</span>
                <span className="font-display text-base">{formatBRL(Math.abs(troco))}</span>
              </div>
            )}
            <Button onClick={() => confirm("dinheiro")} disabled={busy !== null} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Confirmar em dinheiro
            </Button>
          </div>

        ) : (
          /* ── seleção da forma ── */
          <>
            <p className="text-xs text-muted-foreground mt-4 mb-2">{confirmLabel} — escolha a forma de pagamento:</p>
            <div className="grid grid-cols-2 gap-2">
              {PICKER_METHODS.map((m) => {
                const Meta = PAY_META[m];
                return (
                  <button
                    key={m}
                    onClick={() => pick(m)}
                    disabled={busy !== null}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] border border-border p-3.5 hover:border-primary hover:bg-primary/5 transition disabled:opacity-60"
                  >
                    {busy === m ? <Loader2 className="h-5 w-5 animate-spin" /> : <Meta.icon className="h-5 w-5 text-primary shrink-0" />}
                    <span className="text-sm font-medium">{Meta.label}</span>
                  </button>
                );
              })}
            </div>
            {allowSplit && (
              <button onClick={() => setSplitMode(true)} className="w-full mt-3 text-xs text-primary hover:underline py-1">
                Dividir entre formas de pagamento
              </button>
            )}
          </>
        )}
      </Card>
    </MotionModal>
  );
}

function SellProductModal({
  product, onClose, onConfirm,
}: {
  product: ResaleProduct;
  onClose: () => void;
  onConfirm: (qty: number, payment: string) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const price = Number(product.sale_price);
  return (
    <PaymentPickerModal
      title={product.name}
      subtitle={`${formatBRL(price)} cada · ${Number(product.quantity)} em estoque`}
      total={price * qty}
      confirmLabel="Vender"
      onClose={onClose}
      onConfirm={(pay) => onConfirm(qty, pay)}
      extra={
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">Quantidade</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid place-items-center h-8 w-8 rounded-full border border-border hover:bg-muted"><Minus className="h-4 w-4" /></button>
            <span className="font-display font-bold w-6 text-center tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)}
              className="grid place-items-center h-8 w-8 rounded-full border border-border hover:bg-muted"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      }
    />
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
      let professional: string | null = null;
      if (tx.appointment_id) {
        const [{ data: svcs }, { data: appt }] = await Promise.all([
          supabase.from("appointment_services").select("name, price").eq("appointment_id", tx.appointment_id),
          supabase.from("appointments").select("clients(full_name, phone), salon_members(display_name)").eq("id", tx.appointment_id).maybeSingle(),
        ]);
        items = (svcs ?? []).map((s) => ({ name: s.name, price: Number(s.price) }));
        const c = appt?.clients as { full_name?: string; phone?: string | null } | null;
        client = c?.full_name ?? null;
        phone = c?.phone ?? null;
        professional = (appt?.salon_members as { display_name?: string | null } | null)?.display_name ?? null;
      }
      setClientPhone(phone);
      setData({
        client,
        professional,
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
            <div className="mx-auto max-w-xs rounded-[var(--radius)] border border-dashed border-border bg-card p-4 text-sm">
              <div className="text-center space-y-0.5">
                {salon.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={salon.logo_url} alt="" className="mx-auto h-12 w-12 rounded-full object-cover mb-1" />
                )}
                <p className="font-display font-bold leading-tight">{salon.name}</p>
                {(salon.phone || salon.address) && (
                  <p className="text-[11px] text-muted-foreground leading-tight">{[salon.phone, salon.address].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="border-t border-dashed border-border my-2.5" />
              <p className="text-center text-[11px] font-semibold tracking-wide text-muted-foreground">COMPROVANTE DE PAGAMENTO</p>
              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                <p>Data: {data.dateTime}</p>
                {data.client && <p>Cliente: {data.client}</p>}
                {data.professional && <p>Profissional: {data.professional}</p>}
              </div>
              <div className="border-t border-dashed border-border my-2.5" />
              <div className="space-y-1">
                {data.items.length ? data.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-3"><span className="min-w-0 truncate">{i.name}</span><span className="shrink-0 tabular-nums">{formatBRL(i.price)}</span></div>
                )) : (
                  <div className="flex justify-between gap-3"><span className="min-w-0 truncate">{tx.description || "Recebimento"}</span><span className="shrink-0 tabular-nums">{formatBRL(data.total)}</span></div>
                )}
              </div>
              <div className="border-t border-dashed border-border my-2.5" />
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="tabular-nums">{formatBRL(data.total)}</span></div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Forma de pagamento: {payLabel(data.paymentMethod)}</p>
              <div className="border-t border-dashed border-border my-2.5" />
              <p className="text-center text-[11px] font-semibold pt-0.5">Obrigado pela preferência!</p>
              <p className="text-center text-[10px] text-muted-foreground">Te esperamos no próximo horário — agende já!</p>
              <p className="text-center text-[10px] text-muted-foreground pt-2">Documento sem valor fiscal</p>
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

/* ─────────────────── Detalhe e pagamento de comissão ─────────────────── */
function CommissionModal({
  salonId,
  comm,
  period,
  salon,
  canManage,
  onClose,
  onPaid,
}: {
  salonId: string;
  comm: Comm;
  period: Period;
  salon: SalonInfo;
  canManage: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<CommissionLine[]>([]);
  const [phone, setPhone] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const outstanding = Math.max(0, comm.earned - comm.paid);
  const settled = outstanding < 0.01;

  useEffect(() => {
    (async () => {
      const [{ data: svcRows }, { data: redRows }, { data: details }] = await Promise.all([
        supabase
          .from("appointment_services")
          .select("name, price, commission_amount, commission_percent, appointments!inner(starts_at, member_id, status, clients(full_name))")
          .eq("salon_id", salonId)
          .eq("appointments.member_id", comm.member_id)
          .eq("appointments.status", "completed")
          .gte("appointments.starts_at", period.startIso)
          .lte("appointments.starts_at", period.endIso),
        supabase
          .from("package_redemptions")
          .select("used_at, commission_amount, client_packages(name)")
          .eq("salon_id", salonId)
          .eq("member_id", comm.member_id)
          .gte("used_at", period.startIso)
          .lte("used_at", period.endIso),
        supabase
          .from("salon_member_details")
          .select("personal_phone")
          .eq("salon_id", salonId)
          .eq("member_id", comm.member_id)
          .maybeSingle(),
      ]);

      const collected: (CommissionLine & { _iso: string })[] = [];
      for (const r of svcRows ?? []) {
        const appt = r.appointments as unknown as { starts_at: string; clients: { full_name: string | null } | null };
        collected.push({
          _iso: appt.starts_at,
          date: formatDate(appt.starts_at).slice(0, 5),
          service: r.name,
          client: appt.clients?.full_name ?? null,
          base: Number(r.price),
          percent: Number(r.commission_percent),
          commission: Number(r.commission_amount),
        });
      }
      for (const r of redRows ?? []) {
        const pkg = r.client_packages as unknown as { name: string | null } | null;
        collected.push({
          _iso: r.used_at,
          date: formatDate(r.used_at).slice(0, 5),
          service: `Pacote: ${pkg?.name ?? "uso"}`,
          commission: Number(r.commission_amount),
        });
      }
      collected.sort((a, b) => a._iso.localeCompare(b._iso));
      setLines(collected.map(({ _iso, ...l }) => l));
      setPhone((details as { personal_phone?: string | null } | null)?.personal_phone ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const receiptData = (): CommissionReceiptData => ({
    professional: comm.name,
    periodLabel: period.label,
    issuedAt: formatDate(new Date().toISOString()),
    lines,
    total: comm.earned,
    paid: comm.paid,
    outstanding,
    fileBase: `comissao-${comm.name.toLowerCase().replace(/\s+/g, "-")}-${period.start}`,
  });

  async function confirmPay() {
    setPaying(true);
    setErr(null);
    const { error } = await supabase.rpc("pay_commission", {
      p_salon: salonId,
      p_member: comm.member_id,
      p_amount: outstanding,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    setPaying(false);
    if (error) { setErr("Não foi possível registrar o pagamento. Tente novamente."); return; }
    onPaid();
  }

  async function downloadPdf() {
    setBusyPdf(true);
    try { await generateCommissionPdf(receiptData(), salon); } finally { setBusyPdf(false); }
  }

  const waHref = (() => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(buildCommissionText(receiptData(), salon))}`;
  })();

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] flex flex-col p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" /> Comissão
            </h3>
            <p className="text-sm text-muted-foreground truncate">{comm.name} · {period.label}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-3">
          {err && (
            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
              <X className="h-4 w-4 shrink-0" /> {err}
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum serviço apurado no período.</p>
          ) : (
            <div className="rounded-[var(--radius)] border border-border divide-y divide-border">
              {lines.map((ln, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ln.service}</p>
                    <p className="text-xs text-muted-foreground">
                      {ln.date}{ln.client ? ` · ${ln.client}` : ""}
                      {ln.base != null && <> · base {formatBRL(ln.base)}</>}
                      {ln.percent != null && <> · {ln.percent}%</>}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary shrink-0 tabular-nums">{formatBRL(ln.commission)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Totais */}
          <div className="rounded-[var(--radius)] bg-secondary border border-border p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total apurado</span>
              <span className="font-semibold tabular-nums">{formatBRL(comm.earned)}</span>
            </div>
            {comm.paid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Já pago</span>
                <span className="tabular-nums">{formatBRL(comm.paid)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
              <span>A pagar</span>
              <span className="text-primary tabular-nums">{formatBRL(outstanding)}</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="p-5 pt-3 border-t border-border space-y-2">
          {canManage && !settled && (
            <Button onClick={confirmPay} disabled={paying} className="w-full">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar pagamento de {formatBRL(outstanding)}
            </Button>
          )}
          {settled && (
            <p className="text-center text-xs font-medium text-emerald-600 flex items-center justify-center gap-1">
              <Check className="h-4 w-4" /> Comissão deste período já paga
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadPdf} disabled={busyPdf || loading} className="flex-1">
              {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Comprovante
            </Button>
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-10 flex-1 rounded-[var(--radius)] bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            ) : (
              <Button variant="ghost" disabled className="flex-1">Sem telefone</Button>
            )}
          </div>
        </div>
      </Card>
    </MotionModal>
  );
}

function ConfRow({ label, expected, counted, diff }: { label: string; expected: number; counted: number | null; diff: number | null }) {
  const d = diff ?? 0;
  const ok = Math.abs(d) < 0.01;
  return (
    <div className={`flex items-center justify-between rounded-[var(--radius)] px-4 py-3 text-sm font-semibold ${
      ok ? "bg-emerald-500/12 text-emerald-600" : d > 0 ? "bg-amber-500/12 text-amber-700" : "bg-red-500/12 text-red-600"
    }`}>
      <div className="space-y-0.5">
        <span className="block">{label}</span>
        {counted != null && (
          <span className="block text-[11px] font-normal opacity-75">
            Contado {formatBRL(counted)} · Esperado {formatBRL(expected)}
          </span>
        )}
      </div>
      <span className="shrink-0">{ok ? "✓ Conferido" : d > 0 ? `Sobra ${formatBRL(d)}` : `Falta ${formatBRL(Math.abs(d))}`}</span>
    </div>
  );
}

function CloseModal({
  expectedCash,
  incomeByMethod,
  totalIncome,
  totalExpense,
  openingAmount,
  suprimentoTotal = 0,
  sangriaTotal = 0,
  salon,
  onClose,
  onConfirm,
}: {
  expectedCash: number;
  incomeByMethod: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  openingAmount: number;
  suprimentoTotal?: number;
  sangriaTotal?: number;
  salon: SalonInfo;
  onClose: () => void;
  onConfirm: (counted: number) => Promise<boolean>;
}) {
  const [counted, setCounted] = useState("");
  const [countedDebito, setCountedDebito] = useState("");
  const [countedCredito, setCountedCredito] = useState("");
  const [countedPix, setCountedPix] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ClosingReportData | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);

  const countedNum = parseFloat(counted.replace(",", ".")) || 0;
  const diff = countedNum - expectedCash;
  const expectedDebito  = incomeByMethod.debito  ?? 0;
  const expectedCredito = incomeByMethod.credito ?? 0;
  const expectedPix     = incomeByMethod.pix     ?? 0;
  const toNum = (s: string) => s !== "" ? (parseFloat(s.replace(",", ".")) || 0) : null;
  const countedDebitoNum  = toNum(countedDebito);
  const countedCreditoNum = toNum(countedCredito);
  const countedPixNum     = toNum(countedPix);

  const displayMethods = PICKER_METHODS.filter((m) => (incomeByMethod[m] ?? 0) > 0 || m === "dinheiro");

  async function confirm() {
    setBusy(true);
    setErr(null);
    const ok = await onConfirm(countedNum);
    setBusy(false);
    if (!ok) { setErr("Não foi possível fechar o caixa. Tente novamente."); return; }
    const today = new Date();
    setReport({
      date: today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
      openingAmount,
      totalIncome,
      totalExpense,
      incomeByMethod,
      expectedCash,
      countedCash: countedNum,
      difference: diff,
      countedDebito:  countedDebitoNum,
      countedCredito: countedCreditoNum,
      countedPix:     countedPixNum,
      suprimentoTotal,
      sangriaTotal,
      fileBase: `fechamento-${today.toISOString().slice(0, 10)}`,
    });
  }

  async function downloadPdf() {
    if (!report) return;
    setBusyPdf(true);
    try { await generateClosingReportPdf(report, salon); } finally { setBusyPdf(false); }
  }

  const waHref = report
    ? `https://wa.me/?text=${encodeURIComponent(buildClosingReportText(report, salon))}`
    : null;

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        {report ? (
          /* ── estado de sucesso ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" /> Caixa fechado!
              </h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="rounded-[var(--radius)] bg-secondary border border-border p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entradas</span>
                <span className="font-semibold text-emerald-600 tabular-nums">{formatBRL(totalIncome)}</span>
              </div>
              {totalExpense > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saídas</span>
                  <span className="font-semibold text-red-600 tabular-nums">−{formatBRL(totalExpense)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                <span>Saldo líquido</span>
                <span className="tabular-nums">{formatBRL(totalIncome - totalExpense)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {displayMethods.map((m) => {
                const Meta = PAY_META[m];
                return (
                  <div key={m} className="rounded-[var(--radius)] bg-muted px-3 py-2.5 flex items-center gap-2">
                    <Meta.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">{Meta.label}</p>
                      <p className="text-sm font-bold tabular-nums">{formatBRL(incomeByMethod[m] ?? 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <ConfRow label="Dinheiro" expected={expectedCash} counted={report.countedCash} diff={report.difference} />
              {report.countedDebito != null && expectedDebito > 0 && (
                <ConfRow label="Débito" expected={expectedDebito} counted={report.countedDebito} diff={report.countedDebito - expectedDebito} />
              )}
              {report.countedCredito != null && expectedCredito > 0 && (
                <ConfRow label="Crédito" expected={expectedCredito} counted={report.countedCredito} diff={report.countedCredito - expectedCredito} />
              )}
              {report.countedPix != null && expectedPix > 0 && (
                <ConfRow label="PIX" expected={expectedPix} counted={report.countedPix} diff={report.countedPix - expectedPix} />
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={downloadPdf} disabled={busyPdf} variant="outline" className="flex-1">
                {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
              </Button>
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 flex-1 h-10 rounded-[var(--radius)] bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>

            <Button variant="ghost" onClick={onClose} className="w-full">Fechar</Button>
          </div>
        ) : (
          /* ── formulário de fechamento (cego — sem mostrar valores do sistema) ── */
          <>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Fechar caixa
              </h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Conte o dinheiro na gaveta sem consultar o sistema e informe o total abaixo. O resumo completo aparecerá após o fechamento.
            </p>

            <div className="space-y-4 mt-5">
              <div className="space-y-1.5">
                <Label htmlFor="counted">Total em dinheiro na gaveta (R$)</Label>
                <Input id="counted" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>

              {expectedDebito > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="counted-debito">
                    Total débito (R$)
                    <span className="ml-1 text-[11px] text-muted-foreground font-normal">· opcional</span>
                  </Label>
                  <Input id="counted-debito" value={countedDebito} onChange={(e) => setCountedDebito(e.target.value)} placeholder="0,00" inputMode="decimal" />
                  <p className="text-[11px] text-muted-foreground">Consulte o relatório de débito da maquininha</p>
                </div>
              )}

              {expectedCredito > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="counted-credito">
                    Total crédito (R$)
                    <span className="ml-1 text-[11px] text-muted-foreground font-normal">· opcional</span>
                  </Label>
                  <Input id="counted-credito" value={countedCredito} onChange={(e) => setCountedCredito(e.target.value)} placeholder="0,00" inputMode="decimal" />
                  <p className="text-[11px] text-muted-foreground">Consulte o relatório de crédito da maquininha</p>
                </div>
              )}

              {expectedPix > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="counted-pix">
                    Total recebido em PIX (R$)
                    <span className="ml-1 text-[11px] text-muted-foreground font-normal">· opcional</span>
                  </Label>
                  <Input id="counted-pix" value={countedPix} onChange={(e) => setCountedPix(e.target.value)} placeholder="0,00" inputMode="decimal" />
                  <p className="text-[11px] text-muted-foreground">Confira no aplicativo do banco ou extrato PIX</p>
                </div>
              )}
            </div>

            {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

            <div className="flex gap-2 mt-5">
              <Button onClick={confirm} disabled={busy || counted === ""} className="flex-1">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar fechamento
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            </div>
          </>
        )}
      </Card>
    </MotionModal>
  );
}

function SessionDetailModal({
  session,
  salon,
  onClose,
}: {
  session: Session;
  salon: SalonInfo;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busyPdf, setBusyPdf] = useState(false);

  useEffect(() => {
    supabase
      .from("cash_transactions")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setTxs(data ?? []); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const incomes = txs.filter((t) => t.type === "income");
  const expenses = txs.filter((t) => t.type === "expense");
  const totalInc = incomes.reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = expenses.reduce((s, t) => s + Number(t.amount), 0);

  const incByMethod: Record<string, number> = {};
  for (const m of [...PICKER_METHODS, "cartao"] as const) {
    incByMethod[m] = incomes
      .filter((t) => (t.payment_method ?? "dinheiro") === m)
      .reduce((s, t) => s + Number(t.amount), 0);
  }
  const displayMethods = PICKER_METHODS.filter((m) => (incByMethod[m] ?? 0) > 0 || m === "dinheiro");

  const sessionDate = session.closed_at
    ? new Date(session.closed_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const reportData: ClosingReportData = {
    date: sessionDate,
    openingAmount: Number(session.opening_amount),
    totalIncome: totalInc,
    totalExpense: totalExp,
    incomeByMethod: incByMethod,
    expectedCash: session.expected_amount != null ? Number(session.expected_amount) : Number(session.opening_amount) + (incByMethod["dinheiro"] ?? 0),
    countedCash: session.closing_amount != null ? Number(session.closing_amount) : null,
    difference: session.difference != null ? Number(session.difference) : null,
    fileBase: `fechamento-${(session.closed_at ?? "").slice(0, 10)}`,
  };

  async function downloadPdf() {
    setBusyPdf(true);
    try { await generateClosingReportPdf(reportData, salon); } finally { setBusyPdf(false); }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(buildClosingReportText(reportData, salon))}`;

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] flex flex-col p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" /> Relatório do Caixa
            </h3>
            <p className="text-sm text-muted-foreground truncate">{sessionDate}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Resumo financeiro */}
            <div className="rounded-[var(--radius)] bg-secondary border border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Total entradas</span>
                <span className="font-semibold text-emerald-600 tabular-nums">{formatBRL(totalInc)}</span>
              </div>
              {totalExp > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-red-500" /> Total saídas</span>
                  <span className="font-semibold text-red-600 tabular-nums">−{formatBRL(totalExp)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                <span>Saldo líquido</span>
                <span className="tabular-nums">{formatBRL(totalInc - totalExp)}</span>
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Abertura</span>
                  <span className="tabular-nums">{formatBRL(Number(session.opening_amount))}</span>
                </div>
                {session.expected_amount != null && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Esperado em caixa</span>
                    <span className="tabular-nums">{formatBRL(Number(session.expected_amount))}</span>
                  </div>
                )}
                {session.closing_amount != null && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Contado</span>
                    <span className="tabular-nums">{formatBRL(Number(session.closing_amount))}</span>
                  </div>
                )}
                {session.difference != null && (
                  <div className={`flex justify-between text-xs font-semibold ${
                    Number(session.difference) === 0 ? "text-emerald-600"
                    : Number(session.difference) > 0 ? "text-emerald-600"
                    : "text-red-600"
                  }`}>
                    <span>{Number(session.difference) === 0 ? "Conferido" : Number(session.difference) > 0 ? "Sobra" : "Falta"}</span>
                    <span className="tabular-nums">{Number(session.difference) === 0 ? "✓" : formatBRL(Math.abs(Number(session.difference)))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Entradas por forma */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">ENTRADAS POR FORMA</p>
              <div className="grid grid-cols-2 gap-2">
                {displayMethods.map((m) => {
                  const Meta = PAY_META[m];
                  return (
                    <div key={m} className="rounded-[var(--radius)] bg-muted px-3 py-2.5 flex items-center gap-2">
                      <Meta.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">{Meta.label}</p>
                        <p className="text-sm font-bold tabular-nums">{formatBRL(incByMethod[m] ?? 0)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Baixar / compartilhar */}
            <div className="flex gap-2">
              <Button onClick={downloadPdf} disabled={busyPdf || loading} variant="outline" className="flex-1">
                {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
              </Button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 flex-1 h-10 rounded-[var(--radius)] bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>

            {/* Lista de movimentações */}
            {txs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">MOVIMENTAÇÕES</p>
                <div className="space-y-2">
                  {txs.map((t) => <TxRow key={t.id} t={t} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </MotionModal>
  );
}
