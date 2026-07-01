"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  ArrowDown,
  ArrowUp,
  CalendarX,
  CaretLeft,
  CaretRight,
  CircleNotch,
  ClockCounterClockwise,
  MagnifyingGlass,
  Minus,
  Plus,
  Stack,
  Trash,
  TrendDown,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { daysUntilStockout, PRODUCT_INSIGHTS_WINDOW_DAYS, type ProductInsight } from "@/lib/productInsights";
import { loadMoreMovements } from "./inventoryActions";
import { type Movement } from "./types";

type Product = Tables<"products">;

export function InventoryManager({
  slug,
  salonId,
  initial,
  movements,
  movementsHasMore,
  canManage,
  insights = {},
}: {
  slug: string;
  salonId: string;
  initial: Product[];
  movements: Movement[];
  movementsHasMore: boolean;
  canManage: boolean;
  insights?: Record<string, ProductInsight>;
}) {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("0");
  const [min, setMin] = useState("0");
  const [cost, setCost] = useState("");
  const [sale, setSale] = useState("");
  const [isResale, setIsResale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "resale" | "supply">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "low" | "dormant">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [movementsList, setMovementsList] = useState<Movement[]>(movements);
  const [hasMoreMovements, setHasMoreMovements] = useState(movementsHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    setLoadingMore(true);
    const { movements: next, hasMore } = await loadMoreMovements(slug, movementsList.length);
    setMovementsList((list) => [...list, ...next]);
    setHasMoreMovements(hasMore);
    setLoadingMore(false);
  }

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
        sale_price: isResale ? parseFloat(sale.replace(",", ".")) || 0 : 0,
        is_resale: isResale,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      setErr("Não foi possível cadastrar o produto. Tente novamente.");
      return;
    }
    setProducts((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName(""); setQty("0"); setMin("0"); setCost(""); setSale(""); setIsResale(false); setAdding(false);
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (typeFilter === "resale" && !p.is_resale) return false;
      if (typeFilter === "supply" && p.is_resale) return false;
      if (statusFilter === "low") {
        const low = Number(p.quantity) <= Number(p.min_quantity) && Number(p.min_quantity) > 0;
        if (!low) return false;
      }
      if (statusFilter === "dormant") {
        const insight = insights[p.id];
        const dormant = p.is_resale && p.is_active && (!insight || insight.consumedQty === 0);
        if (!dormant) return false;
      }
      return true;
    });
  }, [products, search, typeFilter, statusFilter, insights]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginated = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div className="space-y-6 af-rise">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length === products.length
              ? `${products.length} produtos.`
              : `${filtered.length} de ${products.length} produtos.`}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-amber-300 bg-amber-50 text-amber-800 p-3 text-sm">
          <Warning className="h-4 w-4 shrink-0" />
          {lowStock.length} produto(s) no estoque mínimo: {lowStock.map((p) => p.name).join(", ")}
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <Warning className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <AnimatePresence>
        {adding && (
          <MotionModal key="add-product" onClose={() => setAdding(false)}>
            <Card className="w-full sm:max-w-lg mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold">Novo produto</h3>
                <button onClick={() => setAdding(false)} className="p-1 rounded hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
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
                {isResale && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ps">Preço de venda (R$)</Label>
                    <Input id="ps" value={sale} onChange={(e) => setSale(e.target.value)} placeholder="0,00" />
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-[var(--radius)] border border-border p-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsResale((v) => !v)}
                  aria-pressed={isResale}
                  className={`relative h-6 w-11 rounded-full transition shrink-0 mt-0.5 ${isResale ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${isResale ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <div>
                  <p className="text-sm font-medium">Produto para revenda?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ligue se você vende este produto direto à cliente (balcão). Desligado, é
                    um <b>insumo</b> — usado nos serviços e contabilizado só pelo custo.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button onClick={add} disabled={busy || !name} className="flex-1">
                  {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Adicionar
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </Card>
          </MotionModal>
        )}
      </AnimatePresence>

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9"
            />
          </div>
          <div className="flex rounded-[var(--radius)] border border-border p-0.5 text-sm">
            {([
              ["all", "Todos"],
              ["supply", "Insumos"],
              ["resale", "Revenda"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTypeFilter(val)}
                className={`px-2.5 py-1.5 rounded-[calc(var(--radius)-2px)] transition ${
                  typeFilter === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-[var(--radius)] border border-border p-0.5 text-sm">
            {([
              ["all", "Todo status"],
              ["low", "Estoque baixo"],
              ["dormant", "Parados"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-2.5 py-1.5 rounded-[calc(var(--radius)-2px)] transition whitespace-nowrap ${
                  statusFilter === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <Stack className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhum produto cadastrado.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <MagnifyingGlass className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhum produto encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((p) => {
            const low = Number(p.quantity) <= Number(p.min_quantity) && Number(p.min_quantity) > 0;
            const insight = insights[p.id];
            const margin = p.is_resale ? Number(p.sale_price) - Number(p.cost_price) : null;
            const daysLeft = daysUntilStockout(Number(p.quantity), insight);
            const dormant = p.is_resale && p.is_active && (!insight || insight.consumedQty === 0);
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{p.name}</p>
                    <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 shrink-0 ${p.is_resale ? "bg-emerald-500/12 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {p.is_resale ? "revenda" : "insumo"}
                    </span>
                    {dormant && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5 text-[10px] font-medium shrink-0">
                        <CalendarX className="h-3 w-3" /> parado há {PRODUCT_INSIGHTS_WINDOW_DAYS}+ dias
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-x-2 flex-wrap mt-0.5">
                    <span>
                      custo {formatBRL(Number(p.cost_price))}
                      {p.is_resale && <> · venda {formatBRL(Number(p.sale_price))}</>}
                    </span>
                    {margin != null && (
                      <span className={margin < 0 ? "text-red-600" : "text-emerald-600"}>
                        · lucro {formatBRL(margin)}
                      </span>
                    )}
                    {insight && insight.consumedQty > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendDown className="h-3 w-3" /> {insight.consumedQty} em {PRODUCT_INSIGHTS_WINDOW_DAYS}d
                      </span>
                    )}
                    {daysLeft != null && (
                      <span className={daysLeft <= 7 ? "text-amber-600 font-medium" : ""}>
                        · acaba em ~{daysLeft}d
                      </span>
                    )}
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
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Página {pageSafe} de {totalPages} · {filtered.length} produto{filtered.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((v) => Math.max(1, v - 1))}
                  disabled={pageSafe <= 1}
                  className="grid place-items-center h-8 w-8 rounded-full border border-border hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <CaretLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                  disabled={pageSafe >= totalPages}
                  className="grid place-items-center h-8 w-8 rounded-full border border-border hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <CaretRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Movimentações recentes (inclui baixas automáticas por atendimento) */}
      {movementsList.length > 0 && (
        <div>
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <ClockCounterClockwise className="h-5 w-5 text-primary" /> Movimentações recentes
          </h2>
          <div className="space-y-1.5">
            {movementsList.map((m) => {
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
          {hasMoreMovements && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-3 w-full rounded-[var(--radius)] border border-dashed border-border py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loadingMore && <CircleNotch className="h-4 w-4 animate-spin" />}
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
