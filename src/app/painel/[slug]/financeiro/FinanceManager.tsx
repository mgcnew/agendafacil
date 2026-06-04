"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, formatTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  Wallet, Loader2, TrendingUp, TrendingDown, Lock, Unlock, Percent, Plus,
} from "lucide-react";

type Session = Tables<"cash_sessions">;
type Tx = Tables<"cash_transactions">;
type Comm = { name: string; total: number };

export function FinanceManager({
  salonId,
  canManage,
  openSession,
  transactions,
  commissions,
}: {
  salonId: string;
  canManage: boolean;
  openSession: Session | null;
  transactions: Tx[];
  commissions: Comm[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"caixa" | "comissoes">("caixa");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("0");

  // form transação
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [method, setMethod] = useState("dinheiro");

  const income = transactions.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const balance = (openSession ? Number(openSession.opening_amount) : 0) + income - expense;

  async function openCash() {
    setBusy(true);
    await supabase.from("cash_sessions").insert({
      salon_id: salonId,
      opening_amount: parseFloat(opening.replace(",", ".")) || 0,
    });
    setBusy(false);
    router.refresh();
  }

  async function closeCash() {
    if (!openSession) return;
    if (!confirm("Fechar o caixa agora?")) return;
    setBusy(true);
    await supabase
      .from("cash_sessions")
      .update({ closed_at: new Date().toISOString(), closing_amount: balance })
      .eq("id", openSession.id);
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
                <Stat icon={Wallet} label="Saldo atual" value={formatBRL(balance)} />
                <Stat icon={TrendingUp} label="Entradas" value={formatBRL(income)} />
                <Stat icon={TrendingDown} label="Saídas" value={formatBRL(expense)} />
                <Stat icon={Wallet} label="Abertura" value={formatBRL(Number(openSession.opening_amount))} />
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
                    <Button variant="outline" onClick={closeCash} disabled={busy}>
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
                        <span className={`grid place-items-center h-9 w-9 rounded-full ${t.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
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
        </div>
      )}

      {tab === "comissoes" && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Comissões dos atendimentos concluídos neste mês.
          </p>
          {commissions.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
              <Percent className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3">Nenhuma comissão apurada ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card p-4">
                  <span className="font-medium">{c.name}</span>
                  <span className="font-semibold text-primary">{formatBRL(c.total)}</span>
                </div>
              ))}
            </div>
          )}
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
