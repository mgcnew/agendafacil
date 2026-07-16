"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import {
  CircleNotch,
  DoorOpen,
  Plus,
  PencilSimple,
  Trash,
  TrendUp,
  Users,
  CurrencyDollarSimple,
  Percent,
  UploadSimple,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Prospecção — pipeline de vendas do dono do SaaS. Cada salão abordado é uma
 * linha na tabela `growth_leads` (RLS restringe a platform_admin). Mostra o
 * funil por salão + um resumo por canal (qual canal mais converte), pra guiar
 * onde investir o tempo de divulgação. Ligado às sugestões da aba Playbook.
 */

type Lead = {
  id: string;
  name: string;
  neighborhood: string | null;
  channel: string;
  stage: string;
  contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const CHANNELS: { id: string; label: string }[] = [
  { id: "porta_a_porta", label: "Porta a porta" },
  { id: "indicacao", label: "Indicação" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "google", label: "Google" },
  { id: "parceria", label: "Parceria" },
  { id: "outro", label: "Outro" },
];
const channelLabel = (id: string) => CHANNELS.find((c) => c.id === id)?.label ?? id;

const STAGES: { id: string; label: string; cls: string }[] = [
  { id: "a_visitar", label: "A visitar", cls: "bg-violet-500/12 text-violet-600" },
  { id: "abordado", label: "Abordado", cls: "bg-slate-500/12 text-slate-600" },
  { id: "demo", label: "Demo feita", cls: "bg-blue-500/12 text-blue-600" },
  { id: "testando", label: "Testando", cls: "bg-amber-500/15 text-amber-600" },
  { id: "pagante", label: "Pagante", cls: "bg-emerald-500/12 text-emerald-600" },
  { id: "perdido", label: "Perdido", cls: "bg-red-500/12 text-red-600" },
];
const stageMeta = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];

type FormState = {
  name: string;
  neighborhood: string;
  channel: string;
  stage: string;
  contact: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  neighborhood: "",
  channel: "porta_a_porta",
  stage: "abordado",
  contact: "",
  notes: "",
};

type ParsedRow = { name: string; neighborhood: string | null; contact: string | null };

/**
 * Converte a lista colada (uma linha por salão) em linhas prontas. Aceita
 * vírgula, ponto-e-vírgula ou tab (colar de planilha). Ordem esperada:
 * Nome, Bairro, Telefone — só o nome é obrigatório. Pula cabeçalho e vazios.
 */
function parseImport(text: string): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[;,\t]/).map((p) => p.trim());
    const name = parts[0];
    if (!name) continue;
    const low = name.toLowerCase();
    if ((low === "nome" || low === "name" || low === "salão" || low === "salao") && parts.length > 1) {
      continue; // linha de cabeçalho
    }
    out.push({
      name,
      neighborhood: parts[1] || null,
      contact: parts[2] || null,
    });
  }
  return out;
}

export function ProspeccaoPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [channelFilter, setChannelFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [importChannel, setImportChannel] = useState("porta_a_porta");
  const [importSaving, setImportSaving] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("growth_leads")
      .select("*")
      .order("updated_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setImporting(false);
    setEditing("new");
  }

  const parsedImport = useMemo(() => parseImport(importText), [importText]);

  async function runImport() {
    const rows = parsedImport;
    if (rows.length === 0) return;
    setImportSaving(true);
    const supabase = createClient();
    const payload = rows.map((r) => ({
      name: r.name,
      neighborhood: r.neighborhood,
      contact: r.contact,
      channel: importChannel,
      stage: "a_visitar",
    }));
    await supabase.from("growth_leads").insert(payload);
    setImportSaving(false);
    setImporting(false);
    setImportText("");
    await load();
  }
  function openEdit(l: Lead) {
    setForm({
      name: l.name,
      neighborhood: l.neighborhood ?? "",
      channel: l.channel,
      stage: l.stage,
      contact: l.contact ?? "",
      notes: l.notes ?? "",
    });
    setEditing(l);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      neighborhood: form.neighborhood.trim() || null,
      channel: form.channel,
      stage: form.stage,
      contact: form.contact.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing === "new") {
      await supabase.from("growth_leads").insert(payload);
    } else if (editing) {
      await supabase.from("growth_leads").update(payload).eq("id", editing.id);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  // Mudança rápida de etapa direto no card (sem abrir o formulário).
  async function quickStage(id: string, stage: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    const supabase = createClient();
    await supabase.from("growth_leads").update({ stage }).eq("id", id);
  }

  async function remove(l: Lead) {
    if (!confirm(`Remover "${l.name}" do pipeline?`)) return;
    const supabase = createClient();
    await supabase.from("growth_leads").delete().eq("id", l.id);
    await load();
  }

  // ── Resumo geral ──────────────────────────────────────────────
  const totals = useMemo(() => {
    const total = leads.length;
    const testando = leads.filter((l) => l.stage === "testando").length;
    const pagantes = leads.filter((l) => l.stage === "pagante").length;
    const conv = total ? Math.round((pagantes / total) * 100) : 0;
    return { total, testando, pagantes, conv };
  }, [leads]);

  // ── Resumo por canal (qual canal converte melhor) ─────────────
  const byChannel = useMemo(() => {
    const rows = CHANNELS.map((c) => {
      const ls = leads.filter((l) => l.channel === c.id);
      const pagantes = ls.filter((l) => l.stage === "pagante").length;
      const testando = ls.filter((l) => l.stage === "testando").length;
      return {
        id: c.id,
        label: c.label,
        total: ls.length,
        testando,
        pagantes,
        conv: ls.length ? Math.round((pagantes / ls.length) * 100) : 0,
      };
    }).filter((r) => r.total > 0);
    rows.sort((a, b) => b.pagantes - a.pagantes || b.total - a.total);
    return rows;
  }, [leads]);

  const filtered = leads.filter(
    (l) =>
      (!channelFilter || l.channel === channelFilter) &&
      (!stageFilter || l.stage === stageFilter),
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho + ação */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 shrink-0 rounded-xl bg-primary/12 text-primary">
            <DoorOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold leading-tight">Prospecção</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Seu pipeline de divulgação. Registre cada salão, o canal de origem e a etapa — e veja qual canal converte.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => { setImporting(true); setEditing(null); }}>
            <UploadSimple className="h-4 w-4" /> Importar
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </div>

      {/* KPIs gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="No pipeline" value={String(totals.total)} />
        <Kpi icon={TrendUp} label="Testando" value={String(totals.testando)} />
        <Kpi icon={CurrencyDollarSimple} label="Pagantes" value={String(totals.pagantes)} highlight />
        <Kpi icon={Percent} label="Conversão geral" value={`${totals.conv}%`} />
      </div>

      {/* Resumo por canal */}
      {byChannel.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 font-semibold text-sm">Desempenho por canal</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Canal</th>
                  <th className="text-left px-4 py-2 font-semibold">Abordados</th>
                  <th className="text-left px-4 py-2 font-semibold">Testando</th>
                  <th className="text-left px-4 py-2 font-semibold">Pagantes</th>
                  <th className="text-left px-4 py-2 font-semibold">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? "bg-muted/20" : ""}>
                    <td className="px-4 py-2 font-medium">{r.label}</td>
                    <td className="px-4 py-2">{r.total}</td>
                    <td className="px-4 py-2">{r.testando}</td>
                    <td className="px-4 py-2 font-semibold text-emerald-600">{r.pagantes}</td>
                    <td className="px-4 py-2 text-primary font-medium">{r.conv}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Importar lista (colar texto/CSV) */}
      {importing && (
        <Card className="p-5 space-y-3">
          <p className="font-display font-bold">Importar lista de salões</p>
          <p className="text-sm text-muted-foreground">
            Cole uma linha por salão, na ordem <b>Nome, Bairro, Telefone</b> (só o nome é obrigatório).
            Aceita vírgula, ponto-e-vírgula ou colado direto de planilha. Todos entram como <b>&ldquo;A visitar&rdquo;</b>.
          </p>
          <Textarea
            rows={7}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"Studio Bella, Centro, (11) 90000-0000\nBarbearia do Zé, Jardim, (11) 98888-7777\nEspaço Glam"}
          />
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="imp-canal">Canal de origem (para todos)</Label>
              <Select id="imp-canal" value={importChannel} onValueChange={setImportChannel} className="sm:w-52">
                {CHANNELS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </Select>
            </div>
            <p className="text-sm text-muted-foreground sm:flex-1 sm:pb-2">
              {parsedImport.length > 0
                ? `${parsedImport.length} salão(ões) prontos pra importar.`
                : "Cole a lista acima para pré-visualizar."}
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setImporting(false)}>Cancelar</Button>
            <Button onClick={runImport} disabled={importSaving || parsedImport.length === 0}>
              {importSaving && <CircleNotch className="h-4 w-4 animate-spin" />}
              Importar{parsedImport.length ? ` ${parsedImport.length}` : ""}
            </Button>
          </div>
        </Card>
      )}

      {/* Formulário (novo/editar) */}
      {editing && (
        <Card className="p-5">
          <p className="font-display font-bold mb-3">
            {editing === "new" ? "Novo salão no pipeline" : `Editar — ${editing.name}`}
          </p>
          <form onSubmit={save} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Nome do salão *</Label>
                <Input id="p-name" required value={form.name} autoFocus
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Studio Bella" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-bairro">Bairro / região</Label>
                <Input id="p-bairro" value={form.neighborhood}
                  onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                  placeholder="Ex.: Centro" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-canal">Canal de origem</Label>
                <Select id="p-canal" value={form.channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  {CHANNELS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-etapa">Etapa</Label>
                <Select id="p-etapa" value={form.stage}
                  onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                  {STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-contato">Contato (WhatsApp)</Label>
                <Input id="p-contato" value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-obs">Observações</Label>
                <Textarea id="p-obs" value={form.notes} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex.: dona interessada, voltar quinta; usa caderno hoje." />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filtros */}
      {leads.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={channelFilter} onValueChange={setChannelFilter} className="sm:w-52">
            <option value="">Todos os canais</option>
            {CHANNELS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter} className="sm:w-52">
            <option value="">Todas as etapas</option>
            {STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </Select>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <CircleNotch className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-[var(--radius)]">
          <p className="text-sm text-muted-foreground">
            Seu pipeline está vazio. Clique em <b>Novo</b> pra registrar o primeiro salão abordado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} salão(ões)</p>
          {filtered.map((l) => {
            const meta = stageMeta(l.stage);
            return (
              <Card key={l.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{l.name}</p>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[l.neighborhood, channelLabel(l.channel), l.contact].filter(Boolean).join(" · ")}
                    </p>
                    {l.notes && <p className="text-sm text-foreground/80 mt-1.5">{l.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(l)} title="Editar"
                      className="grid place-items-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted">
                      <PencilSimple className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(l)} title="Remover"
                      className="grid place-items-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Avanço rápido de etapa */}
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Mudar etapa:</span>
                  <Select value={l.stage} onValueChange={(v) => quickStage(l.id, v)} className="h-9 flex-1 sm:max-w-[200px]">
                    {STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                  </Select>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`font-display text-2xl font-bold mt-1 ${highlight ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}
