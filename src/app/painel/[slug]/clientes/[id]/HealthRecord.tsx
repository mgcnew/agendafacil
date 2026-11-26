"use client";

import { useCallback, useEffect, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  Check,
  CircleNotch,
  ClipboardText,
  ClockCounterClockwise,
  Plus,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";

type Supa = ReturnType<typeof createClient>;
type Allergy = Tables<"client_allergies">;
type ServiceNote = Tables<"client_service_notes">;
type Change = Tables<"client_anamnesis_changes">;
type Member = { id: string; profile_id: string | null; name: string | null };

/** O que a ficha técnica precisa saber de cada atendimento recente. */
export type RecordAppt = {
  id: string;
  starts_at: string;
  status: string;
  member_id: string | null;
  services: string;
};

export const ALLERGY_CATEGORIES: { value: string; label: string }[] = [
  { value: "esmalte", label: "Esmalte" },
  { value: "tintura", label: "Tintura / coloração" },
  { value: "quimica", label: "Química (alisamento, descoloração)" },
  { value: "cola", label: "Cola (cílios, unhas)" },
  { value: "latex", label: "Látex / luvas" },
  { value: "metal", label: "Metal (níquel, alicate)" },
  { value: "cosmetico", label: "Cosmético / perfume" },
  { value: "medicamento", label: "Medicamento / anestésico" },
  { value: "outro", label: "Outro" },
];
const CATEGORY_LABEL = Object.fromEntries(ALLERGY_CATEGORIES.map((c) => [c.value, c.label]));

const SEVERITY = {
  leve: { label: "Leve", cls: "bg-muted text-muted-foreground" },
  moderada: { label: "Moderada", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-400" },
  grave: { label: "Grave", cls: "bg-red-500/12 text-red-700 dark:text-red-400" },
} as const;
type Severity = keyof typeof SEVERITY;

const today = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD local

/**
 * Alergias, ficha técnica por atendimento e linha do tempo da anamnese.
 *
 * Fica fora do formulário da ficha de propósito: registrar que a cliente
 * reagiu ao esmalte não pode depender de alguém lembrar de apertar "Salvar
 * anamnese" — cada item grava na hora e o histórico vem do banco.
 */
export function useHealthRecord(supabase: Supa, clientId: string, salonId: string) {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [notes, setNotes] = useState<ServiceNote[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myProfile, setMyProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [al, sn, ch, mb, me] = await Promise.all([
      supabase.from("client_allergies").select("*").eq("client_id", clientId).is("archived_at", null).order("created_at"),
      supabase.from("client_service_notes").select("*").eq("client_id", clientId)
        .order("performed_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
      supabase.from("client_anamnesis_changes").select("*").eq("client_id", clientId)
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("salon_members").select("id, profile_id, display_name, profiles(full_name)").eq("salon_id", salonId),
      supabase.auth.getUser(),
    ]);
    setAllergies(al.data ?? []);
    setNotes(sn.data ?? []);
    setChanges(ch.data ?? []);
    // Dona costuma não ter display_name; o nome dela está no perfil.
    setMembers((mb.data ?? []).map((m) => ({
      id: m.id,
      profile_id: m.profile_id,
      name: m.display_name ?? (m.profiles as { full_name?: string | null } | null)?.full_name ?? null,
    })));
    setMyProfile(me.data.user?.id ?? null);
    setLoading(false);
  }, [supabase, clientId, salonId]);

  useEffect(() => {
    let vivo = true;
    (async () => { if (vivo) await reload(); })();
    return () => { vivo = false; };
  }, [reload]);

  return { allergies, notes, changes, members, myProfile, loading, reload };
}

type HealthState = ReturnType<typeof useHealthRecord>;

/* ───────────────────────── Alergias ───────────────────────── */
export function AllergiesCard({
  supabase, clientId, salonId, record, legacyText, canClearLegacy, onClearLegacy, onChanged, prefill,
}: {
  supabase: Supa; clientId: string; salonId: string; record: HealthState;
  legacyText: string; canClearLegacy: boolean; onClearLegacy: () => void;
  onChanged: () => void;
  /** Troca de identidade = abrir o formulário com estes dados. */
  prefill: AllergyDraft | null;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AllergyDraft>(EMPTY_ALLERGY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Reação registrada na ficha técnica → abre o formulário já preenchido.
  const [prefillSeen, setPrefillSeen] = useState<AllergyDraft | null>(null);
  if (prefill && prefill !== prefillSeen) {
    setPrefillSeen(prefill);
    setDraft(prefill);
    setAdding(true);
  }

  async function save() {
    if (!draft.substance.trim()) { setErr("Diga a que ela tem alergia."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from("client_allergies").insert({
      salon_id: salonId,
      client_id: clientId,
      substance: draft.substance.trim(),
      category: draft.category,
      severity: draft.severity,
      reaction: draft.reaction.trim() || null,
      noticed_on: draft.noticed_on || null,
    });
    setBusy(false);
    if (error) { setErr("Não foi possível salvar a alergia. Tente novamente."); return; }
    setAdding(false); setDraft(EMPTY_ALLERGY);
    await record.reload();
    onChanged();
  }

  async function archive(a: Allergy) {
    if (!window.confirm(`Remover a alergia "${a.substance}"? Ela continua no histórico.`)) return;
    setRemoving(a.id);
    const { error } = await supabase.from("client_allergies")
      .update({ archived_at: new Date().toISOString(), archived_by: record.myProfile })
      .eq("id", a.id);
    setRemoving(null);
    if (error) { setErr("Não foi possível remover. Tente novamente."); return; }
    await record.reload();
    onChanged();
  }

  return (
    <Card id="alergias" className="p-6 lg:col-span-2 scroll-mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Warning aria-hidden className="h-5 w-5 text-red-600" /> Alergias e sensibilidades
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Cada alergia aparece no alerta da Agenda com o nome do produto.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { setDraft(EMPTY_ALLERGY); setAdding(true); }}>
            <Plus aria-hidden className="h-4 w-4" /> Adicionar
          </Button>
        )}
      </div>

      {record.loading ? (
        <div className="grid place-items-center py-6"><CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : record.allergies.length === 0 && !adding ? (
        <p className="mt-4 rounded-[var(--radius)] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nenhuma alergia registrada.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-[var(--radius)] border border-border">
          {record.allergies.map((a) => {
            const sev = SEVERITY[a.severity as Severity] ?? SEVERITY.moderada;
            return (
              <li key={a.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.substance}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", sev.cls)}>{sev.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {CATEGORY_LABEL[a.category] ?? a.category}
                    {a.reaction ? ` · ${a.reaction}` : ""}
                    {a.noticed_on ? ` · desde ${formatDate(a.noticed_on + "T12:00:00")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => archive(a)}
                  disabled={removing === a.id}
                  aria-label={`Remover a alergia ${a.substance}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                >
                  <Trash aria-hidden className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="mt-4 space-y-4 rounded-[var(--radius)] border border-border bg-muted/30 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="al-sub">A que ela tem alergia?</Label>
              <Input id="al-sub" autoFocus value={draft.substance} onChange={(e) => setDraft({ ...draft, substance: e.target.value })}
                placeholder="Ex.: esmalte com formaldeído, cola de cílios" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-cat">Categoria</Label>
              <Select id="al-cat" value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                {ALLERGY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-rea">Reação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="al-rea" value={draft.reaction} onChange={(e) => setDraft({ ...draft, reaction: e.target.value })}
                placeholder="Ex.: coceira, vermelhidão, inchaço" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-dt">Percebida em <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="al-dt" type="date" max={today()} value={draft.noticed_on} onChange={(e) => setDraft({ ...draft, noticed_on: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Gravidade</Label>
            <div role="group" aria-label="Gravidade" className="flex flex-wrap gap-2">
              {(Object.keys(SEVERITY) as Severity[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={draft.severity === s}
                  onClick={() => setDraft({ ...draft, severity: s })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    draft.severity === s ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted",
                  )}
                >
                  {SEVERITY[s].label}
                </button>
              ))}
            </div>
          </div>
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar alergia
            </Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setErr(null); }}>Cancelar</Button>
          </div>
        </div>
      )}
      {!adding && err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}

      {legacyText.trim() && (
        <div className="mt-4 rounded-[var(--radius)] border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Anotação antiga</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{legacyText}</p>
          {canClearLegacy && (
            <button type="button" onClick={onClearLegacy} className="mt-2 text-xs font-semibold text-primary hover:underline">
              Já passei para a lista — apagar anotação
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export type AllergyDraft = { substance: string; category: string; severity: Severity; reaction: string; noticed_on: string };
const EMPTY_ALLERGY: AllergyDraft = { substance: "", category: "outro", severity: "moderada", reaction: "", noticed_on: "" };

/* ─────────────────── Ficha técnica + linha do tempo ─────────────────── */
export function HealthTimeline({
  supabase, clientId, salonId, record, appts, canManage, onReactionToAllergy,
}: {
  supabase: Supa; clientId: string; salonId: string; record: HealthState;
  appts: RecordAppt[]; canManage: boolean;
  onReactionToAllergy: (d: AllergyDraft) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [filtro, setFiltro] = useState<"tudo" | "atendimentos" | "alteracoes">("tudo");
  const [apptId, setApptId] = useState("");
  const [date, setDate] = useState(today());
  const [products, setProducts] = useState("");
  const [hadReaction, setHadReaction] = useState(false);
  const [reaction, setReaction] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastReaction, setLastReaction] = useState<AllergyDraft | null>(null);

  const nameOfProfile = (pid: string | null) =>
    record.members.find((m) => m.profile_id === pid)?.name ?? null;
  const nameOfMember = (mid: string | null) =>
    record.members.find((m) => m.id === mid)?.name ?? null;
  const myMember = record.members.find((m) => m.profile_id === record.myProfile) ?? null;

  function pickAppt(id: string) {
    setApptId(id);
    const a = appts.find((x) => x.id === id);
    if (a) setDate(new Date(a.starts_at).toLocaleDateString("en-CA"));
  }

  function resetForm() {
    setApptId(""); setDate(today()); setProducts(""); setHadReaction(false); setReaction(""); setObs(""); setErr(null);
  }

  async function save() {
    if (!products.trim() && !obs.trim() && !hadReaction) { setErr("Anote os produtos usados, uma reação ou uma observação."); return; }
    setBusy(true); setErr(null);
    const appt = appts.find((x) => x.id === apptId) ?? null;
    const { error } = await supabase.from("client_service_notes").insert({
      salon_id: salonId,
      client_id: clientId,
      appointment_id: appt?.id ?? null,
      member_id: appt?.member_id ?? myMember?.id ?? null,
      service_label: appt?.services || null,
      products: products.trim() || null,
      had_reaction: hadReaction,
      reaction: hadReaction ? reaction.trim() || null : null,
      notes: obs.trim() || null,
      performed_on: date || today(),
      created_by: record.myProfile,
    });
    setBusy(false);
    if (error) { setErr("Não foi possível salvar a ficha técnica. Tente novamente."); return; }
    setLastReaction(hadReaction ? {
      substance: products.trim().split("\n")[0].slice(0, 80),
      category: "outro",
      severity: "moderada",
      reaction: reaction.trim(),
      noticed_on: date || today(),
    } : null);
    setAdding(false); resetForm();
    await record.reload();
  }

  async function remove(n: ServiceNote) {
    if (!window.confirm("Apagar este registro de atendimento?")) return;
    const { error } = await supabase.from("client_service_notes").delete().eq("id", n.id);
    if (error) { setErr("Não foi possível apagar. Tente novamente."); return; }
    await record.reload();
  }

  type Item =
    | { kind: "note"; at: string; note: ServiceNote }
    | { kind: "change"; at: string; change: Change };
  const items: Item[] = [
    ...(filtro !== "alteracoes" ? record.notes.map((n) => ({ kind: "note" as const, at: n.performed_on + "T23:59:59", note: n })) : []),
    ...(filtro !== "atendimentos" ? record.changes.map((c) => ({ kind: "change" as const, at: c.created_at, change: c })) : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2">
            <ClockCounterClockwise aria-hidden className="h-5 w-5 text-primary" /> Linha do tempo
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            O que foi usado em cada atendimento e cada mudança na ficha, com quem fez.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setAdding(true); }}>
            <ClipboardText aria-hidden className="h-4 w-4" /> Registrar atendimento
          </Button>
        )}
      </div>

      {lastReaction && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-red-300/60 bg-red-500/5 p-3 text-sm">
          <Warning aria-hidden className="h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1 min-w-0">Teve reação. Quer pôr na lista de alergias para avisar nos próximos atendimentos?</span>
          <Button size="sm" onClick={() => { onReactionToAllergy(lastReaction); setLastReaction(null); }}>Adicionar alergia</Button>
          <button type="button" onClick={() => setLastReaction(null)} aria-label="Dispensar" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      {adding && (
        <div className="mt-4 space-y-4 rounded-[var(--radius)] border border-border bg-muted/30 p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="space-y-1.5">
              <Label htmlFor="sn-appt">Atendimento</Label>
              <Select id="sn-appt" value={apptId} onValueChange={pickAppt}>
                <option value="">Sem agendamento ligado</option>
                {appts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatDate(a.starts_at)} · {a.services || "Atendimento"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sn-dt">Data</Label>
              <Input id="sn-dt" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sn-prod">Produtos usados</Label>
            <Textarea id="sn-prod" rows={2} value={products} onChange={(e) => setProducts(e.target.value)}
              placeholder="Marca, cor e número. Ex.: esmalte Risqué Vermelho Ferrari; tinta 7.0 + OX 20 vol" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={hadReaction} onChange={(e) => setHadReaction(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Teve reação
            </label>
            {hadReaction && (
              <Input aria-label="Qual reação" value={reaction} onChange={(e) => setReaction(e.target.value)}
                placeholder="Ex.: vermelhidão na cutícula uma hora depois" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sn-obs">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="sn-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: prefere formato amendoado" />
          </div>
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar registro
            </Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setErr(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div role="group" aria-label="Filtrar linha do tempo" className="mt-4 flex flex-wrap gap-2">
        {([["tudo", "Tudo"], ["atendimentos", "Atendimentos"], ["alteracoes", "Alterações da ficha"]] as const).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filtro === k}
            onClick={() => setFiltro(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              filtro === k ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {record.loading ? (
        <div className="grid place-items-center py-6"><CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius)] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nada registrado ainda. Ao registrar um atendimento, anote os produtos usados — é isso que responde
          &quot;o que usamos da última vez?&quot;.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((it) => it.kind === "note" ? (
            <li key={"n" + it.note.id} className={cn(
              "rounded-[var(--radius)] border p-3",
              it.note.had_reaction ? "border-red-300/60 bg-red-500/5" : "border-border",
            )}>
              <div className="flex items-start gap-3">
                <ClipboardText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {it.note.service_label || "Atendimento"}
                    {it.note.had_reaction && (
                      <span className="ml-2 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-700">Teve reação</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(it.note.performed_on + "T12:00:00")}
                    {nameOfMember(it.note.member_id) ? ` · ${nameOfMember(it.note.member_id)}` : ""}
                  </p>
                  {it.note.products && <p className="mt-1.5 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Usado: </span>{it.note.products}</p>}
                  {it.note.reaction && <p className="mt-1 text-sm text-red-700"><span className="font-medium">Reação: </span>{it.note.reaction}</p>}
                  {it.note.notes && <p className="mt-1 text-sm text-muted-foreground">{it.note.notes}</p>}
                </div>
                {(canManage || it.note.created_by === record.myProfile) && (
                  <button
                    type="button"
                    onClick={() => remove(it.note)}
                    aria-label="Apagar registro"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                  >
                    <Trash aria-hidden className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ) : (
            <li key={"c" + it.change.id} className="flex items-start gap-3 px-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {formatDate(it.change.created_at)} ·{" "}
                  {it.change.source === "cliente"
                    ? "a cliente, pelo link"
                    : nameOfProfile(it.change.changed_by) ?? "equipe"}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {it.change.changes.map((c, i) => <li key={i} className="text-sm">{c}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
