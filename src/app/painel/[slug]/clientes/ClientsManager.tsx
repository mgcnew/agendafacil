"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { waLink, formatDate, cn } from "@/lib/utils";
import { mensagemErro, DUPLICADO, REGRA_VIOLADA } from "@/lib/erroSupabase";
import { maskBrPhone, toStoredPhone } from "@/lib/whatsapp/phone";
import type { Tables } from "@/lib/database.types";
import {
  AddressBook,
  CaretLeft,
  CaretRight,
  ChatCircle,
  CircleNotch,
  MagnifyingGlass,
  Phone,
  Plus,
  Star,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
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
  slug, salonId, initial, lastVisit, vipIds = [], canManage,
}: {
  slug: string;
  salonId: string;
  initial: Client[];
  lastVisit: Record<string, string>;
  vipIds?: string[];
  canManage: boolean;
}) {
  const supabase = createClient();
  const vipSet = new Set(vipIds);
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
  const [removendo, setRemovendo] = useState<string | null>(null);

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
    if (phone.trim() !== "" && !toStoredPhone(phone)) {
      setErr("Confira o telefone: celular com DDD, como (11) 98765-4321.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        salon_id: salonId,
        full_name: name,
        phone: toStoredPhone(phone),
        email: email || null,
        birth_date: birth || null,
        referral_source: referral || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      setErr(mensagemErro(error, "Não foi possível cadastrar a cliente. Tente novamente.", {
        [REGRA_VIOLADA]: "Confira o telefone: precisa ser um celular com DDD, como (11) 98765-4321.",
        [DUPLICADO]: "Já existe uma cliente com esse telefone. Procure por ela na busca.",
      }));
      return;
    }
    setClients((c) => [...c, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setName(""); setPhone(""); setEmail(""); setBirth(""); setReferral("");
    setAdding(false);
  }

  /**
   * O confirm dizia só "Remover esta cliente?" — numa lista de 30 nomes
   * iguais em altura, não dava para saber qual estava prestes a sumir.
   */
  async function remove(c: Client) {
    if (!confirm(`Remover ${c.full_name} da sua lista de clientes?`)) return;
    setErr(null);
    setRemovendo(c.id);
    const prev = clients;
    setClients((list) => list.filter((x) => x.id !== c.id));
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    setRemovendo(null);
    if (error) {
      setClients(prev); // restaura: o banco recusou (provável vínculo com agendamentos)
      setErr(`Não foi possível remover ${c.full_name} — ela pode ter agendamentos vinculados.`);
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
            <Plus aria-hidden className="h-4 w-4" /> Nova cliente
          </Button>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <MotionModal key="add-client" onClose={() => setAdding(false)}>
            <Card className="w-full sm:max-w-lg mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold">Nova cliente</h3>
                <button
                  type="button" onClick={() => setAdding(false)} aria-label="Fechar"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <X aria-hidden className="h-5 w-5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cn">Nome</Label>
                  <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp">Celular</Label>
                  <Input
                    id="cp"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(maskBrPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    aria-invalid={phone.trim() !== "" && !toStoredPhone(phone)}
                  />
                  {/* Telefone é opcional aqui (cliente de balcão pode não
                      deixar), mas se for preenchido tem que servir — meio
                      telefone nunca recebe mensagem e ninguém percebe. */}
                  {phone.trim() !== "" && !toStoredPhone(phone) && (
                    <p className="mt-1 text-xs text-red-600">
                      Confira o número: celular com DDD, como (11) 98765-4321.
                    </p>
                  )}
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
                  {busy && <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />}
                  {busy ? "Cadastrando…" : "Adicionar"}
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </Card>
          </MotionModal>
        )}
      </AnimatePresence>

      {err && (
        <div role="alert" className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <Warning aria-hidden className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <div className="relative">
        <label htmlFor="busca-cliente" className="sr-only">Buscar cliente por nome ou telefone</label>
        <MagnifyingGlass aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="busca-cliente" type="search" value={q}
          onChange={(e) => { setQ(e.target.value); resetPage(); }}
          placeholder="Buscar por nome ou telefone" className="pl-9"
        />
      </div>

      {/* Reativação: filtrar quem não volta há X dias */}
      <div role="group" aria-label="Filtrar por tempo sem visita" className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">Sem visita há:</span>
        {[
          { d: 0, label: "Todas" },
          { d: 30, label: "30+ dias" },
          { d: 60, label: "60+ dias" },
          { d: 90, label: "90+ dias" },
        ].map((opt) => (
          <button
            key={opt.d}
            type="button"
            onClick={() => { setInactiveDays(opt.d); resetPage(); }}
            aria-pressed={inactiveDays === opt.d}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              inactiveDays === opt.d
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-foreground/30 text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
        {/* O resultado do filtro/busca muda sem sair do lugar: sem região viva,
            quem usa leitor de tela não sabe que a lista encolheu. */}
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {inactiveDays > 0
            ? `${filtered.length} cliente${filtered.length === 1 ? "" : "s"} para reativar`
            : q
              ? `${filtered.length} cliente${filtered.length === 1 ? "" : "s"} encontrada${filtered.length === 1 ? "" : "s"}`
              : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <AddressBook aria-hidden className="h-8 w-8 mx-auto text-muted-foreground" />
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
                    {vipSet.has(c.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 text-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                        <Star aria-hidden className="h-3 w-3" /> VIP
                      </span>
                    )}
                    {c.alert_summary && (
                      <span
                        title={c.alert_summary}
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium"
                      >
                        <Warning aria-hidden className="h-3 w-3" /> alerta
                        {/* "alerta" sozinho não diz de quê — e o texto já está
                            carregado aqui, não custa nada dizer. */}
                        <span className="sr-only">: {c.alert_summary}</span>
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {c.phone && <span className="flex items-center gap-1"><Phone aria-hidden className="h-3 w-3" /> {c.phone}</span>}
                    <span>
                      {days === null
                        ? "Nunca veio"
                        : days === 0
                          ? "Veio hoje"
                          : `Última visita há ${days} dia${days === 1 ? "" : "s"}`}
                    </span>
                  </p>
                </div>
                <CaretRight aria-hidden className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
              {c.phone && (
                <a
                  href={waLink(c.phone, greeting(c))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Chamar ${c.full_name} no WhatsApp`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-emerald-600 transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <ChatCircle aria-hidden className="h-4 w-4" />
                </a>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={removendo !== null}
                  aria-label={`Remover ${c.full_name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                >
                  {removendo === c.id
                    ? <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
                    : <Trash aria-hidden className="h-4 w-4" />}
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
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CaretLeft aria-hidden className="h-4 w-4" /> Anterior
          </button>
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {page + 1} de {totalPages} &middot; {filtered.length} clientes
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima <CaretRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
