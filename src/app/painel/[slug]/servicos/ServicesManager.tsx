"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { formatBRL, formatDuration } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import { Plus, Trash2, Clock, Percent, Loader2, Sparkles, Timer } from "lucide-react";

type Service = Tables<"services">;

export function ServicesManager({
  salonId,
  initial,
}: {
  salonId: string;
  initial: Service[];
}) {
  const [services, setServices] = useState<Service[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [commission, setCommission] = useState("");
  const [hasProcessing, setHasProcessing] = useState(false);
  const [processing, setProcessing] = useState("30");
  const [finish, setFinish] = useState("15");
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  async function add() {
    if (!name) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("services")
      .insert({
        salon_id: salonId,
        name,
        duration_min: parseInt(duration) || 30,
        price: parseFloat(price.replace(",", ".")) || 0,
        commission_percent: commission ? parseFloat(commission.replace(",", ".")) : null,
        processing_time_min: hasProcessing ? parseInt(processing) || 0 : 0,
        finish_time_min: hasProcessing ? parseInt(finish) || 0 : 0,
      })
      .select()
      .single();
    setBusy(false);
    if (!error && data) {
      setServices((s) => [data, ...s]);
      setName(""); setPrice(""); setDuration("30"); setCommission("");
      setHasProcessing(false); setProcessing("30"); setFinish("15");
      setAdding(false);
    }
  }

  async function remove(id: string) {
    const prev = services;
    setServices((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) setServices(prev);
  }

  async function toggleActive(svc: Service) {
    setServices((s) => s.map((x) => (x.id === svc.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from("services").update({ is_active: !svc.is_active }).eq("id", svc.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Serviços</h1>
          <p className="text-muted-foreground text-sm">Os serviços que aparecem no link de agendamento.</p>
        </div>
        <Button onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo serviço
        </Button>
      </div>

      {adding && (
        <Card className="p-6 space-y-4 af-rise">
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
              <Label htmlFor="sprice">Preço (R$)</Label>
              <Input id="sprice" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scom">Comissão (%) — opcional</Label>
              <Input id="scom" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Ex: 40" />
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

          <div className="flex gap-2">
            <Button onClick={add} disabled={busy || !name}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
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
              <span className="font-semibold text-primary">{formatBRL(Number(s.price))}</span>
              <button
                onClick={() => toggleActive(s)}
                className="text-xs rounded-full px-2.5 py-1 border border-border hover:bg-muted"
              >
                {s.is_active ? "Ativo" : "Inativo"}
              </button>
              <button onClick={() => remove(s.id)} className="p-2 text-muted-foreground hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
