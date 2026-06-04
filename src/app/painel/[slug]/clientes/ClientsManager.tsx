"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { Plus, Loader2, Phone, Trash2, Contact, Search } from "lucide-react";

type Client = Tables<"clients">;

export function ClientsManager({
  salonId,
  initial,
  canManage,
}: {
  salonId: string;
  initial: Client[];
  canManage: boolean;
}) {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(q.toLowerCase()) ||
    (c.phone ?? "").includes(q),
  );

  async function add() {
    if (!name) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({ salon_id: salonId, full_name: name, phone: phone || null })
      .select()
      .single();
    setBusy(false);
    if (!error && data) {
      setClients((c) => [...c, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setName(""); setPhone(""); setAdding(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover esta cliente?")) return;
    setClients((c) => c.filter((x) => x.id !== id));
    await supabase.from("clients").delete().eq("id", id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients.length} cadastradas.</p>
        </div>
        {canManage && (
          <Button onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> Nova cliente
          </Button>
        )}
      </div>

      {adding && (
        <Card className="p-6 space-y-4 af-rise">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cn">Nome</Label>
              <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp">Celular</Label>
              <Input id="cp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <Contact className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhuma cliente encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
              <span className="grid place-items-center h-10 w-10 rounded-full bg-secondary text-secondary-foreground font-semibold shrink-0">
                {c.full_name.charAt(0)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.full_name}</p>
                {c.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </p>
                )}
              </div>
              {canManage && (
                <button onClick={() => remove(c.id)} className="p-2 text-muted-foreground hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
