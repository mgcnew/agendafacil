"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { formatBRL, waLink } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { ServiceInsight } from "@/lib/serviceInsights";
import {
  CalendarDots,
  ChatCircle,
  CircleNotch,
  Package,
  PencilSimple,
  Plus,
  ShoppingCart,
  Sparkle,
  Trash,
  X,
} from "@phosphor-icons/react/dist/ssr";

export type Svc = { id: string; name: string; price: number; commission_percent: number | null };
type TemplateItem = { id: string; service_id: string; quantity: number; services: { name: string } | null };
export type Template = Tables<"package_templates"> & { package_template_items: TemplateItem[] };
type PkgItem = Tables<"client_package_items">;
export type Sold = Tables<"client_packages"> & {
  clients: { full_name: string; phone: string | null } | null;
  client_package_items: PkgItem[];
};
export type Pro = { id: string; name: string };
export type Client = { id: string; full_name: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/12 text-emerald-600" },
  completed: { label: "Concluído", cls: "bg-muted text-muted-foreground" },
  expired: { label: "Expirado", cls: "bg-red-500/12 text-red-600" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
const effStatus = (p: Sold) =>
  p.status === "active" && daysLeft(p.expires_at) < 0 ? "expired" : p.status;

export function PackagesManager({
  salonId,
  canManage,
  templates,
  sold,
  services,
  clients,
  pros,
  serviceInsights = {},
}: {
  salonId: string;
  canManage: boolean;
  templates: Template[];
  sold: Sold[];
  services: Svc[];
  clients: Client[];
  pros: Pro[];
  serviceInsights?: Record<string, ServiceInsight>;
}) {
  const [tab, setTab] = useState<"vendidos" | "modelos">("vendidos");
  const [editingTpl, setEditingTpl] = useState<Template | "new" | null>(null);
  const [selling, setSelling] = useState(false);
  const [redeem, setRedeem] = useState<{ pkg: Sold; item: PkgItem } | null>(null);

  return (
    <div className="space-y-6 af-rise">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Pacotes</h1>
          <p className="text-muted-foreground text-sm">
            Venda pacotes (ex.: 4 manicures) e acompanhe o uso de cada cliente.
          </p>
        </div>
        {canManage && (
          tab === "vendidos" ? (
            <Button onClick={() => setSelling(true)} disabled={templates.length === 0}>
              <ShoppingCart className="h-4 w-4" /> Vender pacote
            </Button>
          ) : (
            <Button onClick={() => setEditingTpl("new")}>
              <Plus className="h-4 w-4" /> Novo modelo
            </Button>
          )
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["vendidos", "modelos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "vendidos" ? "Vendidos" : "Modelos"}
          </button>
        ))}
      </div>

      {tab === "vendidos" ? (
        <SoldList sold={sold} canManage={canManage} onUse={(pkg, item) => setRedeem({ pkg, item })} />
      ) : (
        <TemplatesList
          templates={templates}
          canManage={canManage}
          onEdit={(t) => setEditingTpl(t)}
        />
      )}

      <AnimatePresence>
        {editingTpl && (
          <TemplateEditor
            key="template"
            salonId={salonId}
            services={services}
            serviceInsights={serviceInsights}
            template={editingTpl === "new" ? null : editingTpl}
            onClose={() => setEditingTpl(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selling && (
          <SellModal
            key="sell"
            salonId={salonId}
            templates={templates}
            clients={clients}
            onClose={() => setSelling(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {redeem && (
          <RedeemModal key="redeem" pkg={redeem.pkg} item={redeem.item} pros={pros} onClose={() => setRedeem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Pacote comprado, nenhuma sessão usada, há tempo demais — sinal de risco/insatisfação.
const DORMANT_DAYS = 14;
function isDormant(p: Sold): boolean {
  if (effStatus(p) !== "active") return false;
  const noUsage = p.client_package_items.every((it) => it.used === 0);
  if (!noUsage) return false;
  const daysSincePurchase = Math.floor((Date.now() - new Date(p.purchased_at).getTime()) / 86400000);
  return daysSincePurchase >= DORMANT_DAYS;
}

function dormantReminderUrl(p: Sold): string | null {
  if (!p.clients?.phone) return null;
  const first = (p.clients.full_name ?? "").split(" ")[0];
  const msg = `Oi${first ? ` ${first}` : ""}! Vi que você tem o pacote "${p.name}" aqui com a gente esperando pra ser usado 😊 Quer marcar um horário?`;
  return waLink(p.clients.phone, msg);
}

/* ───────────────────────── Vendidos ───────────────────────── */
function SoldList({
  sold,
  canManage,
  onUse,
}: {
  sold: Sold[];
  canManage: boolean;
  onUse: (pkg: Sold, item: PkgItem) => void;
}) {
  if (sold.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
        <Package className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-3">Nenhum pacote vendido ainda.</p>
      </div>
    );
  }

  const dormant = sold.filter(isDormant);
  const expiringSoon = sold.filter(
    (p) => effStatus(p) === "active" && daysLeft(p.expires_at) >= 0 && daysLeft(p.expires_at) <= 7,
  );

  return (
    <div className="space-y-4">
      {(dormant.length > 0 || expiringSoon.length > 0) && (
        <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkle className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold">De olho nos pacotes</p>
          </div>

          {dormant.length > 0 && (
            <div className="rounded-[var(--radius)] border border-border bg-background p-3">
              <p className="text-sm">
                {dormant.length === 1
                  ? `${dormant[0].clients?.full_name?.split(" ")[0] ?? "Uma cliente"} comprou um pacote e ainda não usou nenhuma sessão.`
                  : `${dormant.length} clientes compraram pacote e ainda não usaram nenhuma sessão.`}{" "}
                Quer lembrar?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dormant.map((p) => {
                  const url = dormantReminderUrl(p);
                  const first = p.clients?.full_name?.split(" ")[0] ?? "Cliente";
                  return url ? (
                    <a
                      key={p.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/15 transition"
                    >
                      <ChatCircle className="h-3.5 w-3.5" /> Lembrar {first}
                    </a>
                  ) : (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {first} — sem WhatsApp cadastrado
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {expiringSoon.length > 0 && (
            <div className="rounded-[var(--radius)] border border-border bg-background p-3">
              <p className="text-sm">
                {expiringSoon.length === 1
                  ? "1 pacote vence nos próximos 7 dias."
                  : `${expiringSoon.length} pacotes vencem nos próximos 7 dias.`}{" "}
                Dá uma olhada nos cards abaixo.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
      {sold.map((p) => {
        const st = effStatus(p);
        const meta = STATUS_META[st];
        const dleft = daysLeft(p.expires_at);
        const active = st === "active";
        return (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.clients?.full_name ?? "Cliente"}</p>
                <p className="text-xs text-muted-foreground">{p.name}</p>
              </div>
              <span className={`text-xs rounded-full px-2.5 py-1 font-medium shrink-0 ${meta.cls}`}>{meta.label}</span>
            </div>

            <div className="mt-3 space-y-2">
              {p.client_package_items.map((it) => {
                const remaining = it.total - it.used;
                return (
                  <div key={it.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{it.name}</span>
                        <span className="text-muted-foreground tabular-nums">{it.used}/{it.total}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(it.used / Math.max(1, it.total)) * 100}%` }}
                        />
                      </div>
                    </div>
                    {canManage && active && remaining > 0 && (
                      <Button size="sm" variant="outline" onClick={() => onUse(p, it)}>
                        Usar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDots className="h-3.5 w-3.5" />
                {active
                  ? dleft >= 0 ? `Vence em ${dleft} dia${dleft === 1 ? "" : "s"}` : "Vencido"
                  : `Validade: ${new Date(p.expires_at).toLocaleDateString("pt-BR")}`}
              </span>
              <span className="font-medium text-foreground">{formatBRL(Number(p.price))}</span>
            </div>
          </Card>
        );
      })}
      </div>
    </div>
  );
}

/* ───────────────────────── Modelos ───────────────────────── */
function TemplatesList({
  templates,
  canManage,
  onEdit,
}: {
  templates: Template[];
  canManage: boolean;
  onEdit: (t: Template) => void;
}) {
  const supabase = createClient();
  const router = useRouter();

  async function remove(t: Template) {
    if (!confirm(`Excluir o modelo "${t.name}"?`)) return;
    const { error } = await supabase.from("package_templates").delete().eq("id", t.id);
    if (error) {
      alert("Não foi possível excluir — o modelo pode ter pacotes vendidos vinculados.");
      return;
    }
    router.refresh();
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
        <Package className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-3">Crie um modelo de pacote para começar a vender.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div key={t.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {t.package_template_items.map((i) => `${i.quantity}× ${i.services?.name ?? "serviço"}`).join(" · ")} · {t.validity_days} dias
            </p>
          </div>
          <span className="font-semibold text-primary text-sm">{formatBRL(Number(t.price))}</span>
          {canManage && (
            <>
              <button onClick={() => onEdit(t)} className="p-2 text-muted-foreground hover:text-primary" title="Editar">
                <PencilSimple className="h-4 w-4" />
              </button>
              <button onClick={() => remove(t)} className="p-2 text-muted-foreground hover:text-red-600" title="Excluir">
                <Trash className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Editor de modelo ─────────────────── */
type DraftItem = { service_id: string; quantity: string };

function TemplateEditor({
  salonId,
  services,
  serviceInsights,
  template,
  onClose,
}: {
  salonId: string;
  services: Svc[];
  serviceInsights: Record<string, ServiceInsight>;
  template: Template | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [validity, setValidity] = useState(String(template?.validity_days ?? 30));
  const [price, setPrice] = useState(template ? String(template.price).replace(".", ",") : "");
  const [items, setItems] = useState<DraftItem[]>(
    template
      ? template.package_template_items.map((i) => ({ service_id: i.service_id, quantity: String(i.quantity) }))
      : [{ service_id: services[0]?.id ?? "", quantity: "4" }],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setItem(idx: number, patch: Partial<DraftItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  // Orientação de preço ao vivo — preço avulso somado, desconto efetivo e
  // comissão estimada (real quando há histórico do serviço, senão a do
  // cadastro). Cálculo direto, sem IA — é conta, não opinião (v1 do roadmap).
  const validDraftItems = items.filter((i) => i.service_id && (parseInt(i.quantity) || 0) > 0);
  let standalonePrice = 0;
  let estimatedCommission = 0;
  for (const it of validDraftItems) {
    const svc = services.find((s) => s.id === it.service_id);
    if (!svc) continue;
    const qty = parseInt(it.quantity) || 0;
    standalonePrice += svc.price * qty;
    const insight = serviceInsights[svc.id];
    const commissionPerUnit =
      insight && insight.bookings > 0
        ? insight.avgCommission
        : svc.price * ((svc.commission_percent ?? 0) / 100);
    estimatedCommission += commissionPerUnit * qty;
  }
  const packagePrice = parseFloat(price.replace(",", ".")) || 0;
  const effectiveDiscount = standalonePrice > 0 ? (1 - packagePrice / standalonePrice) * 100 : 0;
  const estimatedProfit = packagePrice - estimatedCommission;

  async function save() {
    const validItems = items.filter((i) => i.service_id && (parseInt(i.quantity) || 0) > 0);
    if (!name.trim() || validItems.length === 0) return;
    setBusy(true);
    setErr(null);
    const payload = {
      name: name.trim(),
      validity_days: parseInt(validity) || 30,
      price: parseFloat(price.replace(",", ".")) || 0,
    };

    let templateId = template?.id;
    if (template) {
      const { error: upErr } = await supabase.from("package_templates").update(payload).eq("id", template.id);
      if (upErr) { setErr("Não foi possível salvar. Tente novamente."); setBusy(false); return; }
      const { error: delErr } = await supabase.from("package_template_items").delete().eq("template_id", template.id);
      if (delErr) { setErr("Não foi possível salvar os itens. Tente novamente."); setBusy(false); return; }
    } else {
      const { data, error: insErr } = await supabase
        .from("package_templates")
        .insert({ salon_id: salonId, ...payload })
        .select("id")
        .single();
      if (insErr || !data) { setErr("Não foi possível criar o pacote. Tente novamente."); setBusy(false); return; }
      templateId = data.id;
    }

    const { error: itemsErr } = await supabase.from("package_template_items").insert(
      validItems.map((i) => ({
        salon_id: salonId,
        template_id: templateId!,
        service_id: i.service_id,
        quantity: parseInt(i.quantity) || 1,
      })),
    );
    if (itemsErr) {
      // Recuperação: ao editar, re-insere os itens anteriores (já apagados) para
      // não deixar o pacote vazio. Ao criar, remove o modelo recém-criado.
      if (template) {
        await supabase.from("package_template_items").insert(
          template.package_template_items.map((i) => ({
            salon_id: salonId,
            template_id: template.id,
            service_id: i.service_id,
            quantity: i.quantity,
          })),
        );
      } else if (templateId) {
        await supabase.from("package_templates").delete().eq("id", templateId);
      }
      setErr("Não foi possível salvar os itens do pacote. Nada foi alterado.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title={template ? "Editar modelo" : "Novo modelo de pacote"} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nome do pacote</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pacote 4 Manicures" />
        </div>

        <div>
          <Label>Serviços incluídos</Label>
          <div className="space-y-2 mt-1.5">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2">
                <Select value={it.service_id} onValueChange={(v) => setItem(idx, { service_id: v })} className="flex-1">
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => setItem(idx, { quantity: e.target.value })}
                  className="w-20"
                  placeholder="Qtd"
                />
                {items.length > 1 && (
                  <button onClick={() => setItems((a) => a.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems((a) => [...a, { service_id: services[0]?.id ?? "", quantity: "1" }])}
              className="text-sm text-primary font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar serviço
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Validade (dias)</Label>
            <Input type="number" min={1} value={validity} onChange={(e) => setValidity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço do pacote (R$)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
          </div>
        </div>

        {validDraftItems.length > 0 && (
          <div className="rounded-[var(--radius)] border border-border p-4 bg-secondary/40">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Sparkle className="h-4 w-4 text-primary" /> Pra te ajudar a decidir o preço
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avulso (somando os serviços)</span>
                <span>{formatBRL(standalonePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto efetivo do pacote</span>
                <span className={effectiveDiscount < 0 ? "text-red-600" : "text-foreground"}>
                  {effectiveDiscount.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Comissão estimada</span>
                <span>{formatBRL(estimatedCommission)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-border">
                <span>Lucro estimado (sem insumo)</span>
                <span className={estimatedProfit < 0 ? "text-red-600" : "text-emerald-600"}>
                  {formatBRL(estimatedProfit)}
                </span>
              </div>
            </div>
            {effectiveDiscount < 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Esse preço está mais caro que comprar os serviços avulsos — pode afastar quem compara.
              </p>
            )}
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex gap-2 pt-1">
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Salvar
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────── Vender pacote ─────────────────── */
function SellModal({
  salonId,
  templates,
  clients,
  onClose,
}: {
  salonId: string;
  templates: Template[];
  clients: Client[];
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [method, setMethod] = useState("dinheiro");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tpl = templates.find((t) => t.id === templateId);

  async function sell() {
    if (!clientId || !templateId) { setErr("Selecione a cliente e o pacote."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("sell_package", {
      p_salon: salonId,
      p_client: clientId,
      p_template: templateId,
      p_payment_method: method,
    });
    if (error) { setErr("Não foi possível vender. Tente novamente."); setBusy(false); return; }
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Vender pacote" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select value={clientId} onValueChange={setClientId}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Pacote</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>

        {tpl && (
          <div className="rounded-[var(--radius)] bg-secondary border border-border p-3 text-sm space-y-1">
            <p className="text-muted-foreground text-xs">
              {tpl.package_template_items.map((i) => `${i.quantity}× ${i.services?.name ?? "serviço"}`).join(" · ")}
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Validade</span>
              <span>{tpl.validity_days} dias</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">{formatBRL(Number(tpl.price))}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={method} onValueChange={setMethod}>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
          </Select>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <Button onClick={sell} disabled={busy || !clientId || !templateId}>
            {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Confirmar venda
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">A venda entra como receita no caixa (se aberto).</p>
      </div>
    </Modal>
  );
}

/* ─────────────────── Usar (resgatar) ─────────────────── */
function RedeemModal({
  pkg,
  item,
  pros,
  onClose,
}: {
  pkg: Sold;
  item: PkgItem;
  pros: Pro[];
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [member, setMember] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function use() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("redeem_package", {
      p_item: item.id,
      p_member: member || undefined,
    });
    if (error) { setErr("Não foi possível registrar o uso."); setBusy(false); return; }
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Usar serviço do pacote" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {pkg.clients?.full_name} · <b className="text-foreground">{item.name}</b> ({item.used}/{item.total} usados)
        </p>
        <div className="space-y-1.5">
          <Label>Profissional que atendeu (comissão)</Label>
          <Select value={member} onValueChange={setMember}>
            <option value="">Não atribuir / sem comissão</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <Button onClick={use} disabled={busy}>
            {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Registrar uso
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────── Modal base ─────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-lg mx-auto max-h-[90vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </Card>
    </MotionModal>
  );
}
