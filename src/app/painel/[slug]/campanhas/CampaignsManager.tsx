"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { formatBRL, cn } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  Plus, Loader2, Tag, Trash2, Pencil, X, Calendar, Check, AlertTriangle, Power,
} from "lucide-react";

type Campaign = Tables<"campaigns">;
type Svc = { id: string; name: string; price: number; price_type: string | null };
type CampSvc = { campaign_id: string; service_id: string };

// Data de hoje (YYYY-MM-DD) em componentes locais — o navegador do salão está no Brasil.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

type StatusKey = "active" | "scheduled" | "ended" | "paused";
function statusOf(c: Campaign): { key: StatusKey; label: string; cls: string } {
  const today = todayStr();
  if (!c.is_active) return { key: "paused", label: "Pausada", cls: "bg-muted text-muted-foreground" };
  if (c.starts_on && c.starts_on > today) return { key: "scheduled", label: "Agendada", cls: "bg-blue-500/12 text-blue-600" };
  if (c.ends_on && c.ends_on < today) return { key: "ended", label: "Encerrada", cls: "bg-muted text-muted-foreground" };
  return { key: "active", label: "Ativa", cls: "bg-emerald-500/12 text-emerald-600" };
}

function periodLabel(c: Campaign) {
  if (!c.starts_on && !c.ends_on) return "Sem prazo";
  if (c.starts_on && c.ends_on) return `${fmtDate(c.starts_on)} – ${fmtDate(c.ends_on)}`;
  if (c.starts_on) return `A partir de ${fmtDate(c.starts_on)}`;
  return `Até ${fmtDate(c.ends_on!)}`;
}

export function CampaignsManager({
  salonId, initial, services, campaignServices,
}: {
  salonId: string;
  initial: Campaign[];
  services: Svc[];
  campaignServices: CampSvc[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; discount: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Abre o editor já preenchido quando vem da sugestão de "dia frio" (Temperatura)
  useEffect(() => {
    if (searchParams.get("nova")) {
      setPrefill({
        name: searchParams.get("nome") ?? "",
        discount: searchParams.get("desconto") ?? "",
      });
      setCreating(true);
      router.replace(pathname, { scroll: false }); // limpa a URL
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const svcCount = (id: string) => campaignServices.filter((cs) => cs.campaign_id === id).length;

  async function toggleActive(c: Campaign) {
    setErr(null);
    const { error } = await supabase.from("campaigns").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { setErr("Não foi possível atualizar a campanha."); return; }
    router.refresh();
  }

  async function remove(c: Campaign) {
    if (!confirm(`Excluir a campanha "${c.name}"?`)) return;
    setErr(null);
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) { setErr("Não foi possível excluir a campanha."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-6 af-rise">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground text-sm">
            Aplique descontos por período sem mexer no preço de cada serviço.
          </p>
        </div>
        <Button onClick={() => { setCreating(true); setErr(null); }}>
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      {initial.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <Tag className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhuma campanha ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie uma promoção de feriado ou data especial em poucos toques.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initial.map((c) => {
            const st = statusOf(c);
            const muted = st.key === "ended" || st.key === "paused";
            return (
              <Card key={c.id} className={cn("p-4 flex items-center gap-4", muted && "opacity-70")}>
                <span className="grid place-items-center h-11 w-11 rounded-full bg-primary/10 text-primary font-display font-bold shrink-0">
                  -{Number(c.discount_percent)}%
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{c.name}</p>
                    <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", st.cls)}>{st.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" /> {periodLabel(c)}
                    {" · "}
                    {c.scope === "all" ? "Todos os serviços" : `${svcCount(c.id)} serviço(s)`}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(c)}
                  title={c.is_active ? "Pausar" : "Ativar"}
                  className={cn(
                    "p-2 rounded-[var(--radius)] hover:bg-muted transition",
                    c.is_active ? "text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button onClick={() => { setEditing(c); setErr(null); }} className="p-2 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(c)} className="p-2 text-muted-foreground hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {(creating || editing) && (
          <CampaignEditor
            key="editor"
            salonId={salonId}
            services={services}
            campaign={editing}
            prefillName={prefill?.name}
            prefillDiscount={prefill?.discount}
            initialServiceIds={editing ? campaignServices.filter((cs) => cs.campaign_id === editing.id).map((cs) => cs.service_id) : []}
            onClose={() => { setCreating(false); setEditing(null); setPrefill(null); }}
            onSaved={() => { setCreating(false); setEditing(null); setPrefill(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Editor ───────────────────────── */
function CampaignEditor({
  salonId, services, campaign, initialServiceIds, onClose, onSaved, prefillName, prefillDiscount,
}: {
  salonId: string;
  services: Svc[];
  campaign: Campaign | null;
  initialServiceIds: string[];
  onClose: () => void;
  onSaved: () => void;
  prefillName?: string;
  prefillDiscount?: string;
}) {
  const supabase = createClient();
  const [name, setName] = useState(campaign?.name ?? prefillName ?? "");
  const [discount, setDiscount] = useState(
    campaign ? String(campaign.discount_percent).replace(".", ",") : (prefillDiscount ?? ""),
  );
  const [scope, setScope] = useState<"all" | "services">(campaign?.scope === "services" ? "services" : "all");
  const [selected, setSelected] = useState<string[]>(initialServiceIds);
  const [startsOn, setStartsOn] = useState(campaign?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(campaign?.ends_on ?? "");
  const [active, setActive] = useState(campaign?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleSvc(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const pct = parseFloat(discount.replace(",", ".")) || 0;

  async function save() {
    if (!name.trim()) { setErr("Dê um nome à campanha."); return; }
    if (pct <= 0 || pct > 100) { setErr("Informe um desconto entre 1 e 100%."); return; }
    if (scope === "services" && selected.length === 0) { setErr("Escolha ao menos um serviço."); return; }
    if (startsOn && endsOn && startsOn > endsOn) { setErr("A data de início é depois da data de fim."); return; }
    setBusy(true);
    setErr(null);

    const payload = {
      salon_id: salonId,
      name: name.trim(),
      discount_percent: pct,
      scope,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      is_active: active,
    };

    let campId = campaign?.id;
    if (campaign) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", campaign.id);
      if (error) { setErr("Não foi possível salvar. Tente novamente."); setBusy(false); return; }
    } else {
      const { data, error } = await supabase.from("campaigns").insert(payload).select("id").single();
      if (error || !data) { setErr("Não foi possível criar a campanha. Tente novamente."); setBusy(false); return; }
      campId = data.id;
    }

    // sincroniza serviços específicos (apaga e reinsere conforme escopo)
    const { error: delErr } = await supabase.from("campaign_services").delete().eq("campaign_id", campId!);
    if (delErr) { setErr("Campanha salva, mas os serviços não foram atualizados. Edite novamente."); setBusy(false); return; }

    if (scope === "services" && selected.length) {
      const rows = selected.map((sid) => ({ salon_id: salonId, campaign_id: campId!, service_id: sid }));
      const { error: insErr } = await supabase.from("campaign_services").insert(rows);
      if (insErr) { setErr("Campanha salva, mas os serviços não foram atualizados. Edite novamente."); setBusy(false); return; }
    }

    onSaved();
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-lg mx-auto max-h-[90vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold">{campaign ? "Editar campanha" : "Nova campanha"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção de Feriado" />
          </div>

          <div className="space-y-1.5">
            <Label>Desconto (%)</Label>
            <Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="20" inputMode="decimal" />
          </div>

          <div className="space-y-1.5">
            <Label>Aplica em</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["all", "services"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "rounded-[var(--radius)] border px-3 py-2 text-sm font-medium transition",
                    scope === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/25",
                  )}
                >
                  {s === "all" ? "Todos os serviços" : "Serviços específicos"}
                </button>
              ))}
            </div>
          </div>

          {scope === "services" && (
            <div className="space-y-1.5">
              <Label>Serviços ({selected.length})</Label>
              <div className="space-y-1.5 max-h-52 overflow-auto rounded-[var(--radius)] border border-border p-2">
                {services.map((s) => {
                  const on = selected.includes(s.id);
                  const onReq = s.price_type === "on_request";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={onReq}
                      onClick={() => toggleSvc(s.id)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-[var(--radius)] border p-2.5 text-sm transition",
                        onReq ? "opacity-50 cursor-not-allowed border-border" : on ? "border-primary bg-secondary/40" : "border-border hover:border-foreground/20",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("grid place-items-center h-5 w-5 rounded border shrink-0", on ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                        {s.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {onReq ? "Sob consulta" : (
                          <>
                            {formatBRL(Number(s.price))}
                            {pct > 0 && <span className="text-primary font-medium"> → {formatBRL(Number(s.price) * (1 - pct / 100))}</span>}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Serviços “sob consulta” não recebem desconto.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início (opcional)</Label>
              <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim (opcional)</Label>
              <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Sem datas, a campanha vale enquanto estiver ativa.
          </p>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={cn("relative h-6 w-11 rounded-full transition shrink-0", active ? "bg-primary" : "bg-muted-foreground/30")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", active ? "left-[22px]" : "left-0.5")} />
            </button>
            <span className="text-sm">Campanha ativa</span>
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {campaign ? "Salvar" : "Criar campanha"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </MotionModal>
  );
}
