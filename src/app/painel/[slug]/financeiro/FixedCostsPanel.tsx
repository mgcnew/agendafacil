"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import {
  Plus, Trash2, TrendingUp, TrendingDown, Loader2, X,
  Building2, Package, Edit2, Check,
} from "lucide-react";

export type FixedCost = {
  id: string;
  name: string;
  amount: number;
  due_day: number | null;
  type: "expense" | "revenue";
  is_active: boolean;
};

export type ChairRental = {
  member_name: string;
  amount: number;
  due_day: number | null;
};

export type ActivePackageSummary = {
  count: number;
  total_value: number;
};

export function FixedCostsPanel({
  salonId,
  fixedCosts,
  chairRentals,
  activePackages,
}: {
  salonId: string;
  fixedCosts: FixedCost[];
  chairRentals: ChairRental[];
  activePackages: ActivePackageSummary;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const [addingType, setAddingType] = useState<"expense" | "revenue" | null>(null);
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDay, setFormDueDay] = useState("");

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDay, setEditDueDay] = useState("");

  const expenses = fixedCosts.filter((c) => c.type === "expense" && c.is_active);
  const revenues = fixedCosts.filter((c) => c.type === "revenue" && c.is_active);

  const totalExpenses = expenses.reduce((s, c) => s + c.amount, 0);
  const totalManualRevenues = revenues.reduce((s, c) => s + c.amount, 0);
  const totalChairRent = chairRentals.reduce((s, r) => s + r.amount, 0);
  const totalRevenues = totalManualRevenues + totalChairRent;
  const net = totalRevenues - totalExpenses;

  async function addCost(type: "expense" | "revenue") {
    const name = formName.trim();
    const amount = parseFloat(formAmount.replace(",", ".")) || 0;
    if (!name || amount <= 0) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("fixed_costs").insert({
      salon_id: salonId,
      name,
      amount,
      due_day: formDueDay ? parseInt(formDueDay) : null,
      type,
    });
    setBusy(false);
    if (error) { setErr("Não foi possível adicionar. Tente novamente."); return; }
    setFormName(""); setFormAmount(""); setFormDueDay(""); setAddingType(null);
    router.refresh();
  }

  async function saveEdit(id: string) {
    const name = editName.trim();
    const amount = parseFloat(editAmount.replace(",", ".")) || 0;
    if (!name || amount <= 0) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("fixed_costs").update({
      name,
      amount,
      due_day: editDueDay ? parseInt(editDueDay) : null,
    }).eq("id", id);
    setBusy(false);
    if (error) { setErr("Não foi possível salvar. Tente novamente."); return; }
    setEditingId(null);
    router.refresh();
  }

  async function removeCost(id: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("fixed_costs").update({ is_active: false }).eq("id", id);
    setBusy(false);
    if (error) { setErr("Não foi possível remover. Tente novamente."); return; }
    router.refresh();
  }

  function startEdit(c: FixedCost) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditAmount(String(c.amount).replace(".", ","));
    setEditDueDay(c.due_day ? String(c.due_day) : "");
    setAddingType(null);
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <X className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      {/* Resultado mensal */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] border border-border bg-card p-4">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <p className="font-display text-lg font-bold mt-2 text-emerald-600">{formatBRL(totalRevenues)}</p>
          <p className="text-xs text-muted-foreground">Receitas previstas</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-card p-4">
          <TrendingDown className="h-4 w-4 text-red-600" />
          <p className="font-display text-lg font-bold mt-2 text-red-600">{formatBRL(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground">Despesas fixas</p>
        </div>
        <div className={`rounded-[var(--radius)] border bg-card p-4 ${net >= 0 ? "border-emerald-200" : "border-red-200"}`}>
          <div className={`h-4 w-4 rounded-full ${net >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`} />
          <p className={`font-display text-lg font-bold mt-2 ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {net >= 0 ? "+" : ""}{formatBRL(net)}
          </p>
          <p className="text-xs text-muted-foreground">Resultado mensal</p>
        </div>
      </div>

      {/* Despesas fixas */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" /> Despesas fixas
          </h3>
          {addingType !== "expense" && (
            <Button variant="outline" size="sm" onClick={() => { setAddingType("expense"); setEditingId(null); }}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          )}
        </div>

        {addingType === "expense" && (
          <AddForm
            onSave={() => addCost("expense")}
            onCancel={() => setAddingType(null)}
            name={formName} setName={setFormName}
            amount={formAmount} setAmount={setFormAmount}
            dueDay={formDueDay} setDueDay={setFormDueDay}
            busy={busy}
          />
        )}

        {expenses.length === 0 && addingType !== "expense" ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-[var(--radius)]">
            Nenhuma despesa fixa cadastrada.
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((c) => (
              <CostRow
                key={c.id}
                cost={c}
                isEditing={editingId === c.id}
                editName={editName} setEditName={setEditName}
                editAmount={editAmount} setEditAmount={setEditAmount}
                editDueDay={editDueDay} setEditDueDay={setEditDueDay}
                onEdit={() => startEdit(c)}
                onSave={() => saveEdit(c.id)}
                onCancel={() => setEditingId(null)}
                onRemove={() => removeCost(c.id)}
                busy={busy}
                colorClass="text-red-600"
              />
            ))}
          </div>
        )}
      </section>

      {/* Receitas previstas */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Receitas previstas
          </h3>
          {addingType !== "revenue" && (
            <Button variant="outline" size="sm" onClick={() => { setAddingType("revenue"); setEditingId(null); }}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          )}
        </div>

        {addingType === "revenue" && (
          <AddForm
            onSave={() => addCost("revenue")}
            onCancel={() => setAddingType(null)}
            name={formName} setName={setFormName}
            amount={formAmount} setAmount={setFormAmount}
            dueDay={formDueDay} setDueDay={setFormDueDay}
            busy={busy}
          />
        )}

        <div className="space-y-2">
          {/* Auto: aluguel de cadeira */}
          {chairRentals.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.member_name}</p>
                <p className="text-xs text-muted-foreground">
                  Aluguel de cadeira{r.due_day ? ` · vence dia ${r.due_day}` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold text-emerald-600">{formatBRL(r.amount)}</span>
              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">auto</span>
            </div>
          ))}

          {/* Auto: pacotes ativos */}
          {activePackages.count > 0 && (
            <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activePackages.count} pacote{activePackages.count !== 1 ? "s" : ""} ativo{activePackages.count !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Crédito já pago pelos clientes</p>
              </div>
              <span className="text-sm font-semibold text-emerald-600">{formatBRL(activePackages.total_value)}</span>
              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">auto</span>
            </div>
          )}

          {/* Manual revenues */}
          {revenues.map((c) => (
            <CostRow
              key={c.id}
              cost={c}
              isEditing={editingId === c.id}
              editName={editName} setEditName={setEditName}
              editAmount={editAmount} setEditAmount={setEditAmount}
              editDueDay={editDueDay} setEditDueDay={setEditDueDay}
              onEdit={() => startEdit(c)}
              onSave={() => saveEdit(c.id)}
              onCancel={() => setEditingId(null)}
              onRemove={() => removeCost(c.id)}
              busy={busy}
              colorClass="text-emerald-600"
            />
          ))}

          {chairRentals.length === 0 && activePackages.count === 0 && revenues.length === 0 && addingType !== "revenue" && (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-[var(--radius)]">
              Nenhuma receita prevista cadastrada.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function AddForm({
  onSave, onCancel,
  name, setName, amount, setAmount, dueDay, setDueDay, busy,
}: {
  onSave: () => void; onCancel: () => void;
  name: string; setName: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  dueDay: string; setDueDay: (v: string) => void;
  busy: boolean;
}) {
  return (
    <Card className="p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1 space-y-1">
          <Label>Nome</Label>
          <Input
            placeholder="ex: Aluguel"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Valor (R$)</Label>
          <Input
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label>Dia do vencimento</Label>
          <Input
            placeholder="ex: 5"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={busy || !name.trim() || !amount}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  );
}

function CostRow({
  cost, isEditing,
  editName, setEditName, editAmount, setEditAmount, editDueDay, setEditDueDay,
  onEdit, onSave, onCancel, onRemove, busy, colorClass,
}: {
  cost: FixedCost; isEditing: boolean;
  editName: string; setEditName: (v: string) => void;
  editAmount: string; setEditAmount: (v: string) => void;
  editDueDay: string; setEditDueDay: (v: string) => void;
  onEdit: () => void; onSave: () => void; onCancel: () => void; onRemove: () => void;
  busy: boolean; colorClass: string;
}) {
  if (isEditing) {
    return (
      <Card className="p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1 space-y-1">
            <Label>Nome</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valor (R$)</Label>
            <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1">
            <Label>Dia do vencimento</Label>
            <Input value={editDueDay} onChange={(e) => setEditDueDay(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{cost.name}</p>
        {cost.due_day && (
          <p className="text-xs text-muted-foreground">Vence dia {cost.due_day}</p>
        )}
      </div>
      <span className={`text-sm font-semibold ${colorClass}`}>{formatBRL(cost.amount)}</span>
      <button
        onClick={onEdit}
        className="grid place-items-center h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Edit2 className="h-4 w-4" />
      </button>
      <button
        onClick={onRemove}
        disabled={busy}
        className="grid place-items-center h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
