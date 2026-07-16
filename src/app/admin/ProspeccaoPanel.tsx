"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { MotionModal } from "@/components/MotionModal";
import { AnimatePresence } from "framer-motion";
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
  MapPin,
  ChatCircle,
  Presentation,
  Hourglass,
  CheckCircle,
  XCircle,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * Prospecção — pipeline de vendas do dono do SaaS. Cada salão abordado é uma
 * linha na tabela `growth_leads` (RLS restringe a platform_admin). Mostra o
 * funil por salão + um resumo por canal (qual canal mais converte), pra guiar
 * onde investir o tempo de divulgação. Ligado às sugestões da aba Playbook.
 */

type Lead = {
  id: string;
  name: string;
  owner_name: string | null;
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

// Ordem do funil, cor "esquentando" até a venda + ícone próprio (dupla
// codificação: reconhece pela cor E pelo desenho, sem depender do tom).
const STAGES: { id: string; label: string; icon: PhosphorIcon; text: string; bar: string }[] = [
  { id: "a_visitar", label: "A visitar", icon: MapPin, text: "text-slate-600", bar: "border-l-slate-400" },
  { id: "abordado", label: "Abordado", icon: ChatCircle, text: "text-blue-600", bar: "border-l-blue-500" },
  { id: "demo", label: "Demo feita", icon: Presentation, text: "text-violet-600", bar: "border-l-violet-500" },
  { id: "testando", label: "Testando", icon: Hourglass, text: "text-amber-600", bar: "border-l-amber-500" },
  { id: "pagante", label: "Pagante", icon: CheckCircle, text: "text-emerald-600", bar: "border-l-emerald-500" },
  { id: "perdido", label: "Perdido", icon: XCircle, text: "text-red-600", bar: "border-l-red-500" },
];

type FormState = {
  name: string;
  ownerName: string;
  neighborhood: string;
  channel: string;
  stage: string;
  contact: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  ownerName: "",
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

/** Normaliza o contato pra número wa.me (assume Brasil: +55 se faltar DDI). */
function waPhone(contact: string | null): string {
  const digits = (contact ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}

const WA_TEMPLATES: { id: string; label: string }[] = [
  { id: "primeiro", label: "Primeiro contato" },
  { id: "followup", label: "Follow-up do teste" },
  { id: "ultimos_dias", label: "Últimos dias do teste" },
];

/**
 * Monta a mensagem do template com os dados do lead. Curta e humana de
 * propósito — o gancho pessoal a dona edita na prévia antes de enviar.
 * O primeiro contato se adapta ao canal (indicação converte mais quente).
 */
function buildMessage(
  lead: Lead,
  templateId: string,
  meuNome: string,
  demoUrl: string | null,
): string {
  const dono = lead.owner_name?.trim();
  const salao = lead.name.trim();
  const bairro = lead.neighborhood?.trim();
  const oi = dono ? `Oi, ${dono}! Tudo bem?` : "Oi, tudo bem?";
  const eu = meuNome.trim() ? ` Aqui é o ${meuNome.trim()}.` : "";

  let msg: string;
  if (templateId === "followup") {
    msg = `${oi} Como está indo o teste do sistema${dono ? "" : ` no ${salao}`}? Se quiser, te ajudo a deixar seus serviços e horários certinhos — leva uns minutos. Qualquer dúvida é só chamar!`;
  } else if (templateId === "ultimos_dias") {
    msg = `${oi} Passando pra lembrar que seu teste está acabando. Curtiu o sistema? Se fizer sentido, a gente já deixa ativo e você não perde nada do que configurou. Tô à disposição!`;
  } else if (lead.channel === "indicacao") {
    msg = `${oi}${eu} Peguei seu contato numa indicação. Trabalho com um sistema de agenda pra salões e queria te mostrar rapidinho como a cliente marca sozinha por um link, com confirmação automática. Posso te mandar um exemplo?`;
  } else if (lead.channel === "porta_a_porta") {
    msg = `${oi}${eu} Passei ${bairro ? `aí no ${bairro} ` : ""}no ${salao} esses dias e queria te mostrar rapidinho o sistema de agenda que comentei. Posso te mandar um exemplo de como sua cliente agendaria?`;
  } else {
    msg = `${oi}${eu} Encontrei o ${salao}${bairro ? ` aqui no ${bairro}` : ""} e queria te mostrar uma forma simples de organizar os agendamentos — a cliente marca sozinha por um link, sem te chamar no WhatsApp toda hora. Posso te mandar um exemplo?`;
  }

  if (demoUrl) {
    msg += `\n\nMontei um exemplo pra você já ver funcionando: ${demoUrl}`;
  }
  return msg;
}

const MEU_NOME_KEY = "prospeccao:meuNome";

// Links dos salões demo (por vertical) pra anexar na mensagem de WhatsApp.
const DEMO_PATHS: Record<string, string> = {
  salao: "/demo-salao",
  barbearia: "/demo-barbearia",
};
function demoUrlFor(seg: string): string | null {
  if (seg !== "salao" && seg !== "barbearia") return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${DEMO_PATHS[seg]}`;
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
  const [waLead, setWaLead] = useState<Lead | null>(null);
  const [waTemplate, setWaTemplate] = useState("primeiro");
  const [waText, setWaText] = useState("");
  const [meuNome, setMeuNome] = useState("");
  const [waDemo, setWaDemo] = useState<"none" | "salao" | "barbearia">("none");

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
      ownerName: l.owner_name ?? "",
      neighborhood: l.neighborhood ?? "",
      channel: l.channel,
      stage: l.stage,
      contact: l.contact ?? "",
      notes: l.notes ?? "",
    });
    setImporting(false);
    setEditing(l);
  }

  // ── Chamar no WhatsApp (wa.me, envio manual) ──────────────────
  function openWa(l: Lead) {
    const nome =
      typeof window !== "undefined" ? localStorage.getItem(MEU_NOME_KEY) ?? "" : "";
    setMeuNome(nome);
    setWaTemplate("primeiro");
    setWaDemo("none");
    setWaText(buildMessage(l, "primeiro", nome, null));
    setEditing(null);
    setImporting(false);
    setWaLead(l);
  }
  function pickWaTemplate(id: string) {
    setWaTemplate(id);
    if (waLead) setWaText(buildMessage(waLead, id, meuNome, demoUrlFor(waDemo)));
  }
  function changeMeuNome(v: string) {
    setMeuNome(v);
    if (typeof window !== "undefined") localStorage.setItem(MEU_NOME_KEY, v);
    if (waLead) setWaText(buildMessage(waLead, waTemplate, v, demoUrlFor(waDemo)));
  }
  function pickWaDemo(seg: "none" | "salao" | "barbearia") {
    setWaDemo(seg);
    if (waLead) setWaText(buildMessage(waLead, waTemplate, meuNome, demoUrlFor(seg)));
  }
  function sendWa() {
    if (!waLead) return;
    const phone = waPhone(waLead.contact);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setWaLead(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      owner_name: form.ownerName.trim() || null,
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

  // Agrupa por etapa, na ordem do funil; só mostra etapas com salões.
  const grouped = useMemo(
    () =>
      STAGES.map((s) => ({ stage: s, items: filtered.filter((l) => l.stage === s.id) })).filter(
        (g) => g.items.length > 0,
      ),
    [filtered],
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
      <AnimatePresence>
      {importing && (
        <MotionModal key="import" onClose={() => setImporting(false)}>
        <Card className="w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-auto p-5 space-y-3 rounded-b-none sm:rounded-[var(--radius)]">
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
        </MotionModal>
      )}
      </AnimatePresence>

      {/* Formulário (novo/editar) */}
      <AnimatePresence>
      {editing && (
        <MotionModal key="edit" onClose={() => setEditing(null)}>
        <Card className="w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-auto p-5 rounded-b-none sm:rounded-[var(--radius)]">
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
                <Label htmlFor="p-owner">Dono / responsável</Label>
                <Input id="p-owner" value={form.ownerName}
                  onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                  placeholder="Ex.: Marcos" />
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
        </MotionModal>
      )}
      </AnimatePresence>

      {/* Chamar no WhatsApp — prévia editável antes de abrir */}
      <AnimatePresence>
      {waLead && (
        <MotionModal key="wa" onClose={() => setWaLead(null)}>
        <Card className="w-full sm:max-w-lg mx-auto max-h-[90vh] overflow-auto p-5 space-y-3 rounded-b-none sm:rounded-[var(--radius)]">
          <div className="flex items-center gap-2">
            <WhatsappLogo className="h-5 w-5 text-emerald-600" />
            <p className="font-display font-bold truncate">WhatsApp — {waLead.name}</p>
          </div>
          {!waLead.contact && (
            <p className="text-xs text-amber-600">
              Esse salão não tem contato salvo — o WhatsApp vai abrir sem número e você escolhe a conversa.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="wa-nome">Seu nome (aparece na mensagem)</Label>
            <Input id="wa-nome" value={meuNome} onChange={(e) => changeMeuNome(e.target.value)} placeholder="Ex.: João" />
          </div>
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <div className="flex flex-wrap gap-1.5">
              {WA_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickWaTemplate(t.id)}
                  className={`text-sm rounded-full px-3 py-1.5 border transition ${
                    waTemplate === t.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Anexar exemplo (demo)</Label>
            <div className="flex flex-wrap gap-1.5">
              {([["none", "Nenhum"], ["salao", "Salão"], ["barbearia", "Barbearia"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => pickWaDemo(id)}
                  className={`text-sm rounded-full px-3 py-1.5 border transition ${
                    waDemo === id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-msg">Mensagem (ajuste o gancho pessoal antes de enviar)</Label>
            <Textarea id="wa-msg" rows={6} value={waText} onChange={(e) => setWaText(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setWaLead(null)}>Cancelar</Button>
            <Button onClick={sendWa} disabled={!waText.trim()}>
              <WhatsappLogo className="h-4 w-4" /> Abrir no WhatsApp
            </Button>
          </div>
        </Card>
        </MotionModal>
      )}
      </AnimatePresence>

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
        <div className="space-y-6">
          {grouped.map(({ stage, items }) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="space-y-2">
                <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${stage.text}`}>
                  <Icon className="h-4 w-4" />
                  {stage.label} · {items.length}
                </div>
                {items.map((l) => (
                  <Card key={l.id} className={`p-4 border-l-4 ${stage.bar}`}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[l.owner_name, l.neighborhood, channelLabel(l.channel), l.contact].filter(Boolean).join(" · ")}
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
                    {/* Avanço rápido de etapa + WhatsApp */}
                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Mudar etapa:</span>
                      <Select value={l.stage} onValueChange={(v) => quickStage(l.id, v)} className="h-9 flex-1 min-w-[130px] sm:max-w-[180px]">
                        {STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => openWa(l)} className="text-emerald-600">
                        <WhatsappLogo className="h-4 w-4" /> WhatsApp
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
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
