"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { waLink, formatDate, cn } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  Plus, Loader2, Phone, Trash2, Contact, Search, AlertTriangle, ChevronRight, X, MessageCircle,
  ChevronLeft,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";

type Client = Tables<"clients">;

const DAY_MS = 86_400_000;
/** Dias desde a última visita (null se nunca veio). */
function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

export function ClientsManager({
  slug, salonId, initial, lastVisit, canManage,
}: {
  slug: string;
  salonId: string;
  initial: Client[];
  lastVisit: Record<string, string>;
  canManage: boolean;
}) {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birth, setBirth] = useState("");
  const [referral, setReferral] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [inactiveDays, setInactiveDays] = useState(0); // 0 = sem filtro; 30/60/90
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 30;

  function resetPage() { setPage(0); }

  const filtered = clients.filter((c) => {
    const matchesQ =
      c.full_name.toLowerCase().includes(q.toLowerCase()) || (c.phone ?? "").includes(q);
    if (!matchesQ) return false;
    if (inactiveDays > 0) {
      const d = daysSince(lastVisit[c.id]);
      // "sumidas" = última visita há mais de X dias (quem nunca veio não entra)
      if (d === null || d < inactiveDays) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const greeting = (c: Client) => `Oi ${c.full_name.split(" ")[0]}! Tudo bem? 😊`;

  async function add() {
    if (!name) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        salon_id: salonId,
        full_name: name,
        phone: phone || null,
        email: email || null,
        birth_date: birth || null,
        referral_source: referral || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      setErr("Não foi possível cadastrar a cliente. Tente novamente.");
      return;
    }
    setClients((c) => [...c, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setName(""); setPhone(""); setEmail(""); setBirth(""); setReferral("");
    setAdding(false);
  }

  async function remove(id: string) {
    if (!confirm("Remover esta cliente?")) return;
    setErr(null);
    const prev = clients;
    setClients((c) => c.filter((x) => x.id !== id));
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      setClients(prev); // restaura: o banco recusou (provável vínculo com agendamentos)
      setErr("Não foi possível remover esta cliente — ela pode ter agendamentos vinculados.");
    }
  }

  return (
    <div className="space-y-6 af-rise">
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

      <AnimatePresence>
        {adding && (
          <MotionModal key="add-client" onClose={() => setAdding(false)}>
            <Card className="w-full sm:max-w-lg mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold">Nova cliente</h3>
                <button onClick={() => setAdding(false)} className="p-1 rounded hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cn">Nome</Label>
                  <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp">Celular</Label>
                  <Input id="cp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ce">E-mail</Label>
                  <Input id="ce" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cb">Nascimento</Label>
                  <Input id="cb" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cr">Como conheceu / indicação</Label>
                  <Input id="cr" value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="Instagram, indicação de..." />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                A ficha de anamnese (saúde, alergias) é preenchida ao abrir a cliente.
              </p>
              <div className="flex gap-2 mt-5">
                <Button onClick={add} disabled={busy || !name} className="flex-1">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </Card>
          </MotionModal>
        )}
      </AnimatePresence>

      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); resetPage(); }} placeholder="Buscar por nome ou telefone" className="pl-9" />
      </div>

      {/* Reativação: filtrar quem não volta há X dias */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">Sem visita há:</span>
        {[
          { d: 0, label: "Todas" },
          { d: 30, label: "30+ dias" },
          { d: 60, label: "60+ dias" },
          { d: 90, label: "90+ dias" },
        ].map((opt) => (
          <button
            key={opt.d}
            onClick={() => { setInactiveDays(opt.d); resetPage(); }}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition font-medium",
              inactiveDays === opt.d
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-foreground/30 text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
        {inactiveDays > 0 && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} cliente{filtered.length === 1 ? "" : "s"} para reativar
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <Contact className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhuma cliente encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((c) => {
            const days = daysSince(lastVisit[c.id]);
            return (
            <div key={c.id} className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card pr-2 hover:border-foreground/20 transition">
              <Link href={`/painel/${slug}/clientes/${c.id}`} className="flex items-center gap-4 p-4 flex-1 min-w-0">
                <span className="grid place-items-center h-10 w-10 rounded-full bg-secondary text-secondary-foreground font-semibold shrink-0">
                  {c.full_name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate flex items-center gap-2">
                    {c.full_name}
                    {c.alert_summary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium">
                        <AlertTriangle className="h-3 w-3" /> alerta
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                    <span>
                      {days === null
                        ? "Nunca veio"
                        : days === 0
                          ? "Veio hoje"
                          : `Última visita há ${days} dia${days === 1 ? "" : "s"}`}
                    </span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
              {c.phone && (
                <a
                  href={waLink(c.phone, greeting(c))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-emerald-600 hover:text-emerald-700 shrink-0"
                  title="Chamar no WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              {canManage && (
                <button onClick={() => remove(c.id)} className="p-2 text-muted-foreground hover:text-red-600 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-[var(--radius)] border border-border hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            {page + 1} de {totalPages} &middot; {filtered.length} clientes
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-[var(--radius)] border border-border hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
