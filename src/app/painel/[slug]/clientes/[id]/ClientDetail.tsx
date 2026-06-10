"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { formatBRL, formatDate, formatTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  HEALTH_CONDITIONS,
  anamnesisToForm,
  computeAlertSummary,
  type Anamnesis,
  type AnamnesisForm,
  type ConditionKey,
} from "@/lib/anamnesis";
import {
  ArrowLeft, AlertTriangle, User, HeartPulse, History, Loader2,
  Check, ShieldCheck, Phone, Mail, Calendar, Cake,
} from "lucide-react";

type Client = Tables<"clients">;
type HistoryItem = {
  id: string;
  starts_at: string;
  status: string;
  total_price: number;
  salon_members: { display_name: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando", confirmed: "Confirmado", in_progress: "Em andamento",
  completed: "Concluído", cancelled: "Cancelado", no_show: "Faltou",
};

type Tab = "dados" | "anamnese" | "historico";

export function ClientDetail({
  slug, client, anamnesis, history, canManage,
}: {
  slug: string;
  client: Client;
  anamnesis: Anamnesis | null;
  history: HistoryItem[];
  canManage: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dados");
  const [alert, setAlert] = useState<string | null>(client.alert_summary);

  return (
    <div className="space-y-6">
      <Link href={`/painel/${slug}/clientes`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="flex items-center gap-4">
        <span className="grid place-items-center h-14 w-14 rounded-full bg-secondary text-secondary-foreground font-display text-xl font-bold shrink-0">
          {client.full_name.charAt(0)}
        </span>
        <div>
          <h1 className="font-display text-2xl">{client.full_name}</h1>
          {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
        </div>
      </div>

      {/* Alerta de segurança */}
      {alert && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-800 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Atenção — anamnese</p>
            <p className="text-sm">{alert}</p>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        {([
          ["dados", "Dados", User],
          ["anamnese", "Anamnese", HeartPulse],
          ["historico", "Histórico", History],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "dados" && (
        <DadosTab supabase={supabase} client={client} canManage={canManage} onSaved={() => router.refresh()} />
      )}
      {tab === "anamnese" && (
        <AnamneseTab
          supabase={supabase}
          client={client}
          anamnesis={anamnesis}
          canManage={canManage}
          onAlertChange={setAlert}
          onSaved={() => router.refresh()}
        />
      )}
      {tab === "historico" && <HistoricoTab history={history} />}
    </div>
  );
}

/* ---------------- Dados ---------------- */
function DadosTab({
  supabase, client, canManage, onSaved,
}: {
  supabase: ReturnType<typeof createClient>;
  client: Client;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(client.full_name);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [birth, setBirth] = useState(client.birth_date ?? "");
  const [referral, setReferral] = useState(client.referral_source ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setSaved(false); setErr(null);
    const { error } = await supabase.from("clients").update({
      full_name: name,
      phone: phone || null,
      email: email || null,
      birth_date: birth || null,
      referral_source: referral || null,
      notes: notes || null,
    }).eq("id", client.id);
    setSaving(false);
    if (error) { setErr("Não foi possível salvar. Tente novamente."); return; }
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card className="p-6 space-y-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="n">Nome</Label>
          <Input id="n" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p"><Phone className="inline h-3.5 w-3.5 mr-1" />Celular</Label>
          <Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canManage} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e"><Mail className="inline h-3.5 w-3.5 mr-1" />E-mail</Label>
          <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canManage} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b"><Cake className="inline h-3.5 w-3.5 mr-1" />Nascimento</Label>
          <Input id="b" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} disabled={!canManage} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="r">Como conheceu / indicação</Label>
          <Input id="r" value={referral} onChange={(e) => setReferral(e.target.value)} disabled={!canManage} placeholder="Instagram, indicação de..." />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="o">Observações</Label>
          <Textarea id="o" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canManage} placeholder="Preferências, particularidades..." />
        </div>
      </div>
      {canManage && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
          {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" /> Salvo!</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Anamnese ---------------- */
function AnamneseTab({
  supabase, client, anamnesis, canManage, onAlertChange, onSaved,
}: {
  supabase: ReturnType<typeof createClient>;
  client: Client;
  anamnesis: Anamnesis | null;
  canManage: boolean;
  onAlertChange: (s: string | null) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AnamnesisForm>(anamnesisToForm(anamnesis));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setField<K extends keyof AnamnesisForm>(k: K, v: AnamnesisForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true); setSaved(false); setErr(null);
    const { data: userRes } = await supabase.auth.getUser();
    const alert = computeAlertSummary(form);
    const consentAt = form.consent_given ? (anamnesis?.consent_at ?? new Date().toISOString()) : null;

    const { error: upErr } = await supabase.from("client_anamnesis").upsert({
      client_id: client.id,
      salon_id: client.salon_id,
      is_pregnant: form.is_pregnant,
      is_breastfeeding: form.is_breastfeeding,
      has_diabetes: form.has_diabetes,
      has_hypertension: form.has_hypertension,
      has_heart_condition: form.has_heart_condition,
      has_coagulation_issue: form.has_coagulation_issue,
      has_epilepsy: form.has_epilepsy,
      has_cancer_treatment: form.has_cancer_treatment,
      has_thyroid: form.has_thyroid,
      allergies: form.allergies || null,
      medications: form.medications || null,
      recent_procedures: form.recent_procedures || null,
      skin_hair_notes: form.skin_hair_notes || null,
      general_notes: form.general_notes || null,
      consent_given: form.consent_given,
      consent_name: form.consent_name || null,
      consent_at: consentAt,
      updated_at: new Date().toISOString(),
      updated_by: userRes.user?.id ?? null,
    });
    if (upErr) { setErr("Não foi possível salvar a ficha. Tente novamente."); setSaving(false); return; }

    const { error: alErr } = await supabase.from("clients").update({ alert_summary: alert }).eq("id", client.id);
    if (alErr) { setErr("Ficha salva, mas o alerta não foi atualizado. Tente novamente."); setSaving(false); return; }

    onAlertChange(alert);
    setSaving(false); setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Condições de saúde */}
      <Card className="p-6">
        <h3 className="font-display font-semibold flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" /> Condições de saúde</h3>
        <p className="text-xs text-muted-foreground mt-1">Marque o que se aplica. Itens críticos geram alerta automático.</p>
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          {HEALTH_CONDITIONS.map((c) => {
            const on = form[c.key as ConditionKey];
            return (
              <button
                key={c.key}
                type="button"
                disabled={!canManage}
                onClick={() => setField(c.key as ConditionKey, !on)}
                className={`flex items-center gap-2.5 rounded-[var(--radius)] border p-3 text-left text-sm transition disabled:opacity-70 ${
                  on ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border hover:border-foreground/20"
                }`}
              >
                <span className={`grid place-items-center h-5 w-5 rounded border shrink-0 ${on ? "bg-amber-500 border-amber-500 text-white" : "border-border"}`}>
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Textos */}
      <Card className="p-6 space-y-4">
        {[
          ["allergies", "Alergias e sensibilidades", "Amônia, henna, látex, esmalte, anestésico, níquel..."],
          ["medications", "Medicamentos em uso", "Ex.: anticoagulante, isotretinoína (Roacutan)..."],
          ["recent_procedures", "Procedimentos / cirurgias recentes", "Botox, preenchimento, peeling, cirurgia..."],
          ["skin_hair_notes", "Histórico de pele / cabelo / unhas", "Química recente, dermatite, lesão ativa, micose..."],
          ["general_notes", "Outras observações de saúde", ""],
        ].map(([key, label, ph]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Textarea
              id={key}
              rows={2}
              value={form[key as keyof AnamnesisForm] as string}
              onChange={(e) => setField(key as keyof AnamnesisForm, e.target.value as never)}
              disabled={!canManage}
              placeholder={ph}
            />
          </div>
        ))}
      </Card>

      {/* Consentimento */}
      <Card className="p-6">
        <h3 className="font-display font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Termo de consentimento</h3>
        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent_given}
            onChange={(e) => setField("consent_given", e.target.checked)}
            disabled={!canManage}
            className="mt-1 h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm text-muted-foreground">
            A cliente declara que as informações acima são verdadeiras e autoriza o tratamento
            desses dados de saúde para fins do atendimento, conforme a LGPD.
          </span>
        </label>
        {form.consent_given && (
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="cn">Declarado por (nome)</Label>
            <Input id="cn" value={form.consent_name} onChange={(e) => setField("consent_name", e.target.value)} disabled={!canManage} placeholder={client.full_name} />
          </div>
        )}
        {anamnesis?.consent_at && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Consentimento registrado em {formatDate(anamnesis.consent_at)}
          </p>
        )}
      </Card>

      {canManage && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar anamnese
          </Button>
          {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" /> Salvo!</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Histórico ---------------- */
function HistoricoTab({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Esta cliente ainda não tem atendimentos registrados.
      </div>
    );
  }
  return (
    <div className="space-y-2 max-w-2xl">
      {history.map((a) => (
        <div key={a.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
          <div className="text-center shrink-0 w-16">
            <p className="text-sm font-semibold">{formatDate(a.starts_at)}</p>
            <p className="text-xs text-muted-foreground">{formatTime(a.starts_at)}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{a.salon_members?.display_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{STATUS_LABEL[a.status] ?? a.status}</p>
          </div>
          <span className="font-semibold text-primary text-sm">{formatBRL(Number(a.total_price))}</span>
        </div>
      ))}
    </div>
  );
}
