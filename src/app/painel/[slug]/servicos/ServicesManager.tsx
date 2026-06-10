"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatServicePrice, formatDuration } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { Niche } from "@/lib/themes";
import { SERVICE_PRESETS } from "@/lib/servicePresets";
import { Plus, Trash2, Clock, Percent, Loader2, Sparkles, Timer, Wand2, X, Check, Pencil, Boxes } from "lucide-react";

type Service = Tables<"services">;
type PriceType = "fixed" | "from" | "on_request";
type Prod = { id: string; name: string; unit: string | null };
type SP = { service_id: string; product_id: string; quantity: number };
type RecipeRow = { product_id: string; quantity: string };

const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  fixed: "Valor exato",
  from: "A partir de",
  on_request: "Sob consulta",
};

export function ServicesManager({
  salonId,
  niche,
  initial,
  products,
  serviceProducts,
}: {
  salonId: string;
  niche: Niche;
  initial: Service[];
  products: Prod[];
  serviceProducts: SP[];
}) {
  const [services, setServices] = useState<Service[]>(initial);
  const [svcProducts, setSvcProducts] = useState<SP[]>(serviceProducts);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [commission, setCommission] = useState("");
  const [hasProcessing, setHasProcessing] = useState(false);
  const [processing, setProcessing] = useState("30");
  const [finish, setFinish] = useState("15");
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const supabase = createClient();

  function resetForm() {
    setName(""); setPrice(""); setDuration("30"); setCommission("");
    setPriceType("fixed");
    setHasProcessing(false); setProcessing("30"); setFinish("15");
    setRecipe([]);
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    setAdding(true);
  }

  function openEdit(svc: Service) {
    setName(svc.name);
    setDuration(String(svc.duration_min));
    setPrice(svc.price ? String(svc.price).replace(".", ",") : "");
    setPriceType((svc.price_type as PriceType) ?? "fixed");
    setCommission(svc.commission_percent != null ? String(svc.commission_percent) : "");
    setHasProcessing(svc.processing_time_min > 0);
    setProcessing(String(svc.processing_time_min || 30));
    setFinish(String(svc.finish_time_min || 15));
    setRecipe(
      svcProducts
        .filter((sp) => sp.service_id === svc.id)
        .map((sp) => ({ product_id: sp.product_id, quantity: String(sp.quantity) })),
    );
    setEditingId(svc.id);
    setAdding(true);
  }

  function setRecipeRow(idx: number, patch: Partial<RecipeRow>) {
    setRecipe((r) => r.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function closeForm() {
    resetForm();
    setErr(null);
    setAdding(false);
  }

  async function save() {
    if (!name) return;
    setBusy(true);
    setErr(null);
    const payload = {
      name,
      duration_min: parseInt(duration) || 30,
      price: priceType === "on_request" ? 0 : parseFloat(price.replace(",", ".")) || 0,
      price_type: priceType,
      commission_percent: commission ? parseFloat(commission.replace(",", ".")) : null,
      processing_time_min: hasProcessing ? parseInt(processing) || 0 : 0,
      finish_time_min: hasProcessing ? parseInt(finish) || 0 : 0,
    };
    let saved: Service | null = null;
    if (editingId) {
      const { data, error } = await supabase
        .from("services").update(payload).eq("id", editingId).select().single();
      if (error || !data) { setErr("Não foi possível salvar o serviço. Tente novamente."); setBusy(false); return; }
      saved = data as Service;
      setServices((s) => s.map((x) => (x.id === editingId ? saved! : x)));
    } else {
      const { data, error } = await supabase
        .from("services").insert({ salon_id: salonId, ...payload }).select().single();
      if (error || !data) { setErr("Não foi possível criar o serviço. Tente novamente."); setBusy(false); return; }
      saved = data as Service;
      setServices((s) => [saved!, ...s]);
    }

    // sincroniza a receita de insumos (service_products)
    const svcId = saved.id;
    const prevRecipe = svcProducts.filter((x) => x.service_id === svcId);
    const { error: delErr } = await supabase.from("service_products").delete().eq("service_id", svcId);
    if (delErr) {
      setErr("Serviço salvo, mas não foi possível atualizar os insumos. Edite novamente.");
      setBusy(false);
      return;
    }
    const rows = recipe
      .filter((r) => r.product_id && (parseFloat(r.quantity.replace(",", ".")) || 0) > 0)
      .map((r) => ({
        salon_id: salonId,
        service_id: svcId,
        product_id: r.product_id,
        quantity: parseFloat(r.quantity.replace(",", ".")) || 1,
      }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("service_products").insert(rows);
      if (insErr) {
        // restaura a receita anterior para não deixar o serviço sem insumos
        if (prevRecipe.length) {
          await supabase.from("service_products").insert(
            prevRecipe.map((r) => ({ salon_id: salonId, service_id: svcId, product_id: r.product_id, quantity: r.quantity })),
          );
        }
        setErr("Serviço salvo, mas não foi possível atualizar os insumos. Edite novamente.");
        setBusy(false);
        return;
      }
    }
    setSvcProducts((sp) => [
      ...sp.filter((x) => x.service_id !== svcId),
      ...rows.map((r) => ({ service_id: r.service_id, product_id: r.product_id, quantity: r.quantity })),
    ]);

    setBusy(false);
    closeForm();
  }

  async function addPresets(picked: { name: string; duration: number }[]) {
    if (!picked.length) {
      setPresetOpen(false);
      return;
    }
    const rows = picked.map((p) => ({
      salon_id: salonId,
      name: p.name,
      duration_min: p.duration,
      price: 0,
      commission_percent: null,
      processing_time_min: 0,
      finish_time_min: 0,
    }));
    const { data, error } = await supabase.from("services").insert(rows).select();
    if (!error && data) {
      setServices((s) => [...(data as Service[]), ...s]);
    }
    setPresetOpen(false);
  }

  async function remove(id: string) {
    const prev = services;
    setServices((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) setServices(prev);
  }

  async function toggleActive(svc: Service) {
    const prev = services;
    setServices((s) => s.map((x) => (x.id === svc.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await supabase.from("services").update({ is_active: !svc.is_active }).eq("id", svc.id);
    if (error) setServices(prev); // desfaz se o banco recusar
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Serviços</h1>
          <p className="text-muted-foreground text-sm">Os serviços que aparecem no link de agendamento.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPresetOpen(true)}>
            <Wand2 className="h-4 w-4" /> Serviços comuns
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo serviço
          </Button>
        </div>
      </div>

      {presetOpen && (
        <PresetPicker
          niche={niche}
          existing={services.map((s) => s.name.trim().toLowerCase())}
          onClose={() => setPresetOpen(false)}
          onConfirm={addPresets}
        />
      )}

      {adding && (
        <Card className="p-6 space-y-4 af-rise">
          <h2 className="font-display font-semibold">
            {editingId ? "Editar serviço" : "Novo serviço"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sname">Nome do serviço</Label>
              <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Corte feminino" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sdur">Duração (min)</Label>
              <Input id="sdur" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scom">Comissão (%) — opcional</Label>
              <Input id="scom" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Ex: 40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sptype">Tipo de preço</Label>
              <Select id="sptype" value={priceType} onValueChange={(v) => setPriceType(v as PriceType)}>
                {(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((t) => (
                  <option key={t} value={t}>{PRICE_TYPE_LABEL[t]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprice">
                {priceType === "from" ? "Valor inicial (R$)" : "Preço (R$)"}
              </Label>
              <Input
                id="sprice"
                value={priceType === "on_request" ? "" : price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                disabled={priceType === "on_request"}
              />
              {priceType === "on_request" && (
                <p className="text-xs text-muted-foreground">A cliente vê &ldquo;Sob consulta&rdquo;.</p>
              )}
            </div>
          </div>
          {/* Tempo de pausa (química / coloração) */}
          <div className="rounded-[var(--radius)] border border-border p-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setHasProcessing((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition shrink-0 mt-0.5 ${hasProcessing ? "bg-primary" : "bg-muted-foreground/30"}`}
                aria-pressed={hasProcessing}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${hasProcessing ? "left-[22px]" : "left-0.5"}`} />
              </button>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-primary" /> Tem tempo de pausa?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Para coloração/química: a profissional fica livre enquanto o produto age e
                  pode atender outra cliente nesse intervalo.
                </p>
              </div>
            </div>
            {hasProcessing && (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="proc">Pausa — produto agindo (min)</Label>
                    <Input id="proc" type="number" value={processing} onChange={(e) => setProcessing(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fin">Trabalho final (min)</Label>
                    <Input id="fin" type="number" value={finish} onChange={(e) => setFinish(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Tempo total da cliente:{" "}
                  <b className="text-foreground">{(parseInt(duration) || 0) + (parseInt(processing) || 0) + (parseInt(finish) || 0)} min</b>{" "}
                  · profissional ocupada apenas{" "}
                  <b className="text-foreground">{(parseInt(duration) || 0) + (parseInt(finish) || 0)} min</b>.
                </p>
              </>
            )}
          </div>

          {/* Insumos consumidos por atendimento (estoque inteligente) */}
          <div className="rounded-[var(--radius)] border border-border p-4">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Boxes className="h-4 w-4 text-primary" /> Insumos consumidos por atendimento
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ao finalizar o atendimento, estes produtos são descontados do estoque automaticamente.
            </p>
            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-3">
                Cadastre produtos no Estoque para vincular insumos.
              </p>
            ) : (
              <div className="space-y-2 mt-3">
                {recipe.map((r, idx) => {
                  const prod = products.find((p) => p.id === r.product_id);
                  return (
                    <div key={idx} className="flex gap-2 items-center">
                      <Select value={r.product_id} onValueChange={(v) => setRecipeRow(idx, { product_id: v })} className="flex-1">
                        <option value="">Selecione o produto</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.quantity}
                        onChange={(e) => setRecipeRow(idx, { quantity: e.target.value })}
                        className="w-24"
                        placeholder="Qtd"
                      />
                      <span className="text-xs text-muted-foreground w-10 shrink-0">{prod?.unit ?? ""}</span>
                      <button type="button" onClick={() => setRecipe((a) => a.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setRecipe((a) => [...a, { product_id: "", quantity: "1" }])}
                  className="text-sm text-primary font-medium flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar insumo
                </button>
              </div>
            )}
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || !name}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>Cancelar</Button>
          </div>
        </Card>
      )}

      {services.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhum serviço cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4 ${!s.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">{s.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(s.duration_min)}</span>
                  {s.commission_percent != null && (
                    <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> {s.commission_percent}%</span>
                  )}
                  {s.processing_time_min > 0 && (
                    <span className="flex items-center gap-1 text-primary"><Timer className="h-3 w-3" /> pausa {s.processing_time_min}min</span>
                  )}
                </div>
              </div>
              <span className="font-semibold text-primary text-sm text-right">
                {formatServicePrice(Number(s.price), s.price_type)}
              </span>
              <button
                onClick={() => toggleActive(s)}
                className="text-xs rounded-full px-2.5 py-1 border border-border hover:bg-muted"
              >
                {s.is_active ? "Ativo" : "Inativo"}
              </button>
              <button onClick={() => openEdit(s)} className="p-2 text-muted-foreground hover:text-primary" title="Editar">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(s.id)} className="p-2 text-muted-foreground hover:text-red-600" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Seletor de serviços comuns ───────────────────── */
function PresetPicker({
  niche,
  existing,
  onClose,
  onConfirm,
}: {
  niche: Niche;
  existing: string[];
  onClose: () => void;
  onConfirm: (picked: { name: string; duration: number }[]) => Promise<void>;
}) {
  const presets = SERVICE_PRESETS[niche] ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const has = (name: string) => existing.includes(name.trim().toLowerCase());

  function toggle(name: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  // agrupa por categoria
  const grouped = presets.reduce<Record<string, typeof presets>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  async function confirm() {
    setBusy(true);
    await onConfirm(presets.filter((p) => selected.has(p.name)));
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-lg max-h-[85vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> Serviços comuns
          </h3>
          <button onClick={onClose} className="p-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Marque os serviços que o seu salão oferece. Depois você ajusta preço e duração.
        </p>

        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((p) => {
                  const added = has(p.name);
                  const on = selected.has(p.name);
                  return (
                    <button
                      key={p.name}
                      type="button"
                      disabled={added}
                      onClick={() => toggle(p.name)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                        added
                          ? "border-border bg-muted text-muted-foreground cursor-default"
                          : on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {p.name}
                      {added && <span className="text-[10px]">já tem</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6 sticky bottom-0 bg-card pt-3">
          <Button onClick={confirm} disabled={busy || selected.size === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}
