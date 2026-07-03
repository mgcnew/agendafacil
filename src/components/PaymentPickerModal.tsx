"use client";

import { useState } from "react";
import { MotionModal } from "@/components/MotionModal";
import { Button, Card, Input, Label } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import {
  CaretLeft,
  Check,
  CircleNotch,
  CreditCard,
  DeviceMobile,
  Money,
  X,
} from "@phosphor-icons/react/dist/ssr";

export const PAY_META: Record<string, { label: string; icon: React.ElementType }> = {
  dinheiro: { label: "Dinheiro", icon: Money },
  pix: { label: "Pix", icon: DeviceMobile },
  debito: { label: "Débito", icon: CreditCard },
  credito: { label: "Crédito", icon: CreditCard },
  cartao: { label: "Cartão", icon: CreditCard }, // legado — exibição de dados antigos
};

export const PICKER_METHODS = ["dinheiro", "pix", "debito", "credito"] as const;

/**
 * Modal de cobrança/venda usado tanto pelo Caixa quanto pela Agenda ao
 * finalizar um atendimento — mesmo componente nos dois lugares pra evitar
 * discrepância entre os fluxos (desconto, split e troco se comportam
 * idênticos onde quer que o fechamento aconteça).
 */
export function PaymentPickerModal({
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
              <CaretLeft className="h-3.5 w-3.5" /> voltar
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
              {busy === "split" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar divisão
            </Button>
          </div>

        ) : cashMode ? (
          /* ── sub-etapa dinheiro: troco ── */
          <div className="mt-4 space-y-3">
            <button onClick={() => { setCashMode(false); setReceived(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <CaretLeft className="h-3.5 w-3.5" /> outras formas
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
              {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Money className="h-4 w-4" />} Confirmar em dinheiro
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
                    {busy === m ? <CircleNotch className="h-5 w-5 animate-spin" /> : <Meta.icon className="h-5 w-5 text-primary shrink-0" />}
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
