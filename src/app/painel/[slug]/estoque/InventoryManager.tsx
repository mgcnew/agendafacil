"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import { Plus, Loader2, Boxes, Trash2, Minus, AlertTriangle, History, ArrowDown, ArrowUp } from "lucide-react";

type Product = Tables<"products">;
export type Movement = {
  id: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string | null;
  created_at: string;
  products: { name: string } | null;
};

export function InventoryManager({
  salonId,
  initial,
  movements,
  canManage,
}: {
  salonId: string;
  initial: Product[];
  movements: Movement[];
  canManage: boolean;
}) {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("0");
  const [min, setMin] = useState("0");
  const [cost, setCost] = useState("");
  const [sale, setSale] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!name) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("products")
      .insert({
        salon_id: salonId,
        name,
        quantity: parseFloat(qty.replace(",", ".")) || 0,
        min_quantity: parseFloat(min.replace(",", ".")) || 0,
        cost_price: parseFloat(cost.replace(",", ".")) || 0,
        sale_price: parseFloat(sale.replace(",", ".")) || 0,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      setErr("Não foi possível cadastrar o produto. Tente novamente.");
      return;
    }
    setProducts((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName(""); setQty("0"); setMin("0"); setCost(""); setSale(""); setAdding(false);
  }

  async function adjust(p: Product, delta: number) {
    setErr(null);
    const prev = products;
    const newQty = Math.max(0, Number(p.quantity) + delta);
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, quantity: newQty } : x)));
    const [{ error: updErr }, { error: movErr }] = await Promise.all([
      supabase.from("products").update({ quantity: newQty }).eq("id", p.id),
      supabase.from("stock_movements").insert({
        salon_id: salonId,
        product_id: p.id,
        type: delta > 0 ? "in" : "out",
        quantity: Math.abs(delta),
      }),
    ]);
    if (updErr || movErr) {
      setProducts(prev); // restaura a quantidade anterior
      setErr("Não foi possível atualizar o estoque. Tente novamente.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este produto?")) return;
    setErr(null);
    const prev = products;
    setProducts((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setProducts(prev); // restaura: provável vínculo com movimentações/atendimentos
      setErr("Não foi possível remover este produto — ele pode ter movimentações vinculadas.");
    }
  }

  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.min_quantity) && Number(p.min_quantity) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground text-sm">{products.length} produtos.</p>
        </div>
        {canManage && (
          <Button onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-amber-300 bg-amber-50 text-amber-800 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {lowStock.length} produto(s) no estoque mínimo: {lowStock.map((p) => p.name).join(", ")}
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      {adding && (
        <Card className="p-6 space-y-4 af-rise">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pn">Produto</Label>
              <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Shampoo profissional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pq">Quantidade</Label>
              <Input id="pq" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm">Estoque mínimo</Label>
              <Input id="pm" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc">Custo (R$)</Label>
              <Input id="pc" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps">Venda (R$)</Label>
              <Input id="ps" value={sale} onChange={(e) => setSale(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={add} disabled={busy || !name}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {products.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <Boxes className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhum produto cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const low = Number(p.quantity) <= Number(p.min_quantity) && Number(p.min_quantity) > 0;
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(Number(p.sale_price))} · custo {formatBRL(Number(p.cost_price))}
                  </p>
                </div>
                {canManage && (
                  <button onClick={() => adjust(p, -1)} className="grid place-items-center h-8 w-8 rounded-full border border-border hover:bg-muted">
                    <Minus className="h-4 w-4" />
                  </button>
                )}
                <span className={`font-display font-bold w-10 text-center ${low ? "text-amber-600" : ""}`}>
                  {Number(p.quantity)}
                </span>
                {canManage && (
                  <button onClick={() => adjust(p, 1)} className="grid place-items-center h-8 w-8 rounded-full border border-border hover:bg-muted">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                {canManage && (
                  <button onClick={() => remove(p.id)} className="p-2 text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Movimentações recentes (inclui baixas automáticas por atendimento) */}
      {movements.length > 0 && (
        <div>
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Movimentações recentes
          </h2>
          <div className="space-y-1.5">
            {movements.map((m) => {
              const out = m.type === "out";
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
                  <span className={`grid place-items-center h-8 w-8 rounded-full shrink-0 ${
                    out ? "bg-red-500/12 text-red-600" : "bg-emerald-500/12 text-emerald-600"
                  }`}>
                    {out ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.products?.name ?? "Produto"}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.reason ?? (out ? "Saída" : m.type === "in" ? "Entrada" : "Ajuste")} ·{" "}
                      {new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${out ? "text-red-600" : "text-emerald-600"}`}>
                    {out ? "−" : "+"}{Number(m.quantity)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
