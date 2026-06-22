"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { MotionModal } from "@/components/MotionModal";
import { AnimatePresence } from "framer-motion";
import { formatBRL, formatDate } from "@/lib/utils";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  Building2, Users, TrendingUp, Clock, AlertTriangle, XCircle,
  Loader2, X, ExternalLink, Sparkles, ShieldCheck,
} from "lucide-react";

export type AdminOverview = {
  total_salons: number;
  trialing: number;
  active: number;
  past_due: number;
  canceled: number;
  mrr: number;
  new_30d: number;
};

export type AdminSalon = {
  salon_id: string;
  name: string;
  slug: string;
  created_at: string;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  plan: string | null;
  status: string | null;
  value: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/12 text-emerald-600" },
  trialing: { label: "Trial", cls: "bg-blue-500/12 text-blue-600" },
  past_due: { label: "Inadimplente", cls: "bg-amber-500/15 text-amber-600" },
  canceled: { label: "Cancelado", cls: "bg-red-500/12 text-red-600" },
};

const statusMeta = (s: string | null) =>
  STATUS_META[s ?? ""] ?? { label: s ?? "—", cls: "bg-muted text-muted-foreground" };

const planName = (p: string | null) => (p && p in PLANS ? PLANS[p as PlanId].name : (p ?? "—"));

export function AdminDashboard({
  overview,
  salons,
}: {
  overview: AdminOverview | null;
  salons: AdminSalon[];
}) {
  const [managing, setManaging] = useState<AdminSalon | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const router = useRouter();

  const filtered = salons.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.owner_name ?? "").toLowerCase().includes(q) ||
      (s.owner_email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-dvh px-5 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">Painel da Plataforma</h1>
            <p className="text-sm text-muted-foreground">Visão geral do SaaS e gestão de assinaturas.</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={TrendingUp} label="MRR (ativos)" value={formatBRL(overview?.mrr ?? 0)} highlight />
          <Kpi icon={Building2} label="Total de salões" value={String(overview?.total_salons ?? 0)} />
          <Kpi icon={Clock} label="Em trial" value={String(overview?.trialing ?? 0)} />
          <Kpi icon={Users} label="Ativos" value={String(overview?.active ?? 0)} />
          <Kpi icon={AlertTriangle} label="Inadimplentes" value={String(overview?.past_due ?? 0)} />
          <Kpi icon={Sparkles} label="Novos (30d)" value={String(overview?.new_30d ?? 0)} />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por salão, link, dono ou e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter} className="sm:w-52">
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="trialing">Em trial</option>
            <option value="past_due">Inadimplentes</option>
            <option value="canceled">Cancelados</option>
          </Select>
        </div>

        {/* Lista de salões */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} salão(ões)</p>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-[var(--radius)]">
              Nenhum salão encontrado.
            </p>
          ) : (
            filtered.map((s) => {
              const meta = statusMeta(s.status);
              return (
                <div key={s.salon_id} className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{s.name}</p>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      /{s.slug} · {s.owner_name || s.owner_email || "sem dono"} · criado {formatDate(s.created_at)}
                    </p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-sm font-semibold">{planName(s.plan)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "trialing" && s.trial_ends_at
                        ? `trial até ${formatDate(s.trial_ends_at)}`
                        : s.current_period_end
                        ? `vence ${formatDate(s.current_period_end)}`
                        : "—"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setManaging(s)} className="shrink-0">
                    Gerenciar
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {managing && (
          <ManageModal
            key="manage"
            salon={managing}
            onClose={() => setManaging(null)}
            onDone={() => { setManaging(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, highlight,
}: { icon: React.ElementType; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[var(--radius)] border bg-card p-4 ${highlight ? "border-primary/40" : "border-border"}`}>
      <Icon className={`h-4 w-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <p className="font-display text-lg font-bold mt-2 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ManageModal({
  salon, onClose, onDone,
}: { salon: AdminSalon; onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const [plan, setPlan] = useState<string>(salon.plan ?? "basic");
  const meta = statusMeta(salon.status);

  async function run(key: string, fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(key);
    setErr(null);
    const { error } = await fn();
    setBusy(null);
    if (error) { setErr("Não foi possível concluir a ação. Tente novamente."); return; }
    onDone();
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[90vh] overflow-auto p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold truncate">{salon.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              /{salon.slug} · {salon.owner_email || "—"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {err && (
            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
              <X className="h-4 w-4 shrink-0" /> {err}
            </div>
          )}

          {/* Situação atual */}
          <div className="rounded-[var(--radius)] bg-secondary border border-border p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{planName(salon.plan)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Trial até</span><span>{salon.trial_ends_at ? formatDate(salon.trial_ends_at) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Próx. cobrança</span><span>{salon.current_period_end ? formatDate(salon.current_period_end) : "—"}</span></div>
          </div>

          {/* Estender trial */}
          <div className="space-y-2">
            <Label>Estender trial</Label>
            <div className="flex gap-2">
              <Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="w-24" />
              <Button
                variant="outline"
                onClick={() => run("trial", () => supabase.rpc("admin_extend_trial" as never, { p_salon: salon.salon_id, p_days: parseInt(days) || 0 } as never))}
                disabled={busy !== null}
                className="flex-1"
              >
                {busy === "trial" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Estender {parseInt(days) || 0} dia(s)
              </Button>
            </div>
          </div>

          {/* Mudar plano */}
          <div className="space-y-2">
            <Label>Plano</Label>
            <div className="flex gap-2">
              <Select value={plan} onValueChange={setPlan} className="flex-1">
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <Button
                variant="outline"
                onClick={() => run("plan", () => supabase.rpc("admin_set_plan" as never, { p_salon: salon.salon_id, p_plan: plan } as never))}
                disabled={busy !== null || plan === salon.plan}
              >
                {busy === "plan" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Acesso */}
          <div className="space-y-2">
            <Label>Acesso</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => run("active", () => supabase.rpc("admin_set_status" as never, { p_salon: salon.salon_id, p_status: "active" } as never))}
                disabled={busy !== null || salon.status === "active"}
              >
                {busy === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} Ativar (cortesia)
              </Button>
              <Button
                variant="outline"
                onClick={() => run("block", () => supabase.rpc("admin_set_status" as never, { p_salon: salon.salon_id, p_status: "canceled" } as never))}
                disabled={busy !== null || salon.status === "canceled"}
                className="text-red-600 hover:bg-red-50"
              >
                {busy === "block" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Bloquear
              </Button>
            </div>
          </div>

          <Link
            href={`/painel/${salon.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> Abrir painel do salão
          </Link>
        </div>
      </Card>
    </MotionModal>
  );
}
