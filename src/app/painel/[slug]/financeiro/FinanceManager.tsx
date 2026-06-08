"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, formatTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  Wallet, Loader2, TrendingUp, TrendingDown, Lock, Unlock, Percent, Plus,
  Banknote, Smartphone, CreditCard, History, X, ChevronLeft, ChevronRight, Check,
} from "lucide-react";

type Session = Tables<"cash_sessions">;
type Tx = Tables<"cash_transactions">;
type Comm = { member_id: string; name: string; earned: number; paid: number };
type Period = { label: string; prevCmes: string; nextCmes: string; start: string; end: string };

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
  initialTab,
  period,
}: {
  salonId: string;
  canManage: boolean;
  openSession: Session | null;
  transactions: Tx[];
  commissions: Comm[];
  closedSessions: Session[];
  initialTab: "caixa" | "comissoes";
  period: Period;
}) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<"caixa" | "comissoes">(initialTab);
  const [payingId, setPayingId] = useState<string | null>(null);

  async function payCommission(c: Comm, outstanding: number) {
    if (!confirm(`Pagar ${formatBRL(outstanding)} de comissão para ${c.name}?`)) return;
    setPayingId(c.member_id);
    await supabase.rpc("pay_commission", {
      p_salon: salonId,
      p_member: c.member_id,
      p_amount: outstanding,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    setPayingId(null);
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
    await supabase.from("cash_sessions").insert({
      salon_id: salonId,
      opening_amount: parseFloat(opening.replace(",", ".")) || 0,
    });
    setBusy(false);
    router.refresh();
  }

  async function addTx() {
    if (!openSession || !amount) return;
    setBusy(true);
    await supabase.from("cash_transactions").insert({
      salon_id: salonId,
      session_id: openSession.id,
      type,
      amount: parseFloat(amount.replace(",", ".")) || 0,
      description: desc || null,
      payment_method: method,
    });
    setBusy(false);
    setAmount(""); setDesc("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Caixa & Comissões</h1>
        <p className="text-muted-foreground text-sm">Controle financeiro do salão.</p>
      </div>

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
                  <div className="grid sm:grid-cols-4 gap-3">
                    <Select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
                      <option value="income">Entrada</option>
                      <option value="expense">Saída</option>
                    </Select>
                    <Input placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartão</option>
                    </Select>
                    <Input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} />
                  </div>
                  <div className="flex justify-between items-center">
                    <Button onClick={addTx} disabled={busy || !amount}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />} Lançar
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
      {closing && openSession && (
        <CloseModal
          expectedCash={expectedCash}
          incomeByMethod={incomeByMethod}
          onClose={() => setClosing(false)}
          onConfirm={async (counted) => {
            await supabase
              .from("cash_sessions")
              .update({
                closed_at: new Date().toISOString(),
                closing_amount: counted,
                expected_amount: expectedCash,
                difference: counted - expectedCash,
              })
              .eq("id", openSession.id);
            setClosing(false);
            router.refresh();
          }}
        />
      )}

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-md p-6 rounded-b-none sm:rounded-[var(--radius)]">
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
    </div>
  );
}
