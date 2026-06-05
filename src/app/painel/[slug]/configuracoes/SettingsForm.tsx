"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { NICHE_LIST, type Niche } from "@/lib/themes";
import type { Tables } from "@/lib/database.types";
import { Copy, Check, Loader2, Link2 } from "lucide-react";

export function SettingsForm({
  salon,
  canEdit,
}: {
  salon: Tables<"salons">;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(salon.name);
  const [niche, setNiche] = useState<Niche>(salon.niche);
  const [phone, setPhone] = useState(salon.phone ?? "");
  const [address, setAddress] = useState(salon.address ?? "");
  const [simultaneous, setSimultaneous] = useState(salon.allow_simultaneous);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/${salon.slug}`
      : `/${salon.slug}`;

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("salons")
      .update({
        name,
        niche,
        phone: phone || null,
        address: address || null,
        allow_simultaneous: simultaneous,
      })
      .eq("id", salon.id);
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Dados do salão e tema visual.</p>
      </div>

      {/* Link de agendamento */}
      <Card className="p-6">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Link de agendamento
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe com suas clientes. É por aqui que elas agendam.
        </p>
        <div className="flex gap-2 mt-4">
          <Input readOnly value={link} className="font-mono text-sm" />
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </Card>

      {/* Dados */}
      <Card className="p-6 space-y-5">
        <h2 className="font-display font-semibold">Dados do salão</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} placeholder="(11) 99999-9999" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Endereço</Label>
          <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} />
        </div>
      </Card>

      {/* Tema */}
      <Card className="p-6">
        <h2 className="font-display font-semibold">Tema visual (segmento)</h2>
        <p className="text-sm text-muted-foreground mt-1">Muda as cores e a tipografia do app.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {NICHE_LIST.map((n) => {
            const active = n.id === niche;
            return (
              <button
                key={n.id}
                type="button"
                disabled={!canEdit}
                onClick={() => setNiche(n.id)}
                className={`text-left rounded-[var(--radius)] border p-4 transition disabled:opacity-60 ${
                  active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/20"
                }`}
              >
                <span className="inline-block h-4 w-4 rounded-full mb-2" style={{ background: n.swatch }} />
                <p className="font-semibold text-sm">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.tagline}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Agenda */}
      <Card className="p-6">
        <h2 className="font-display font-semibold">Agenda</h2>
        <div className="flex items-start gap-3 mt-4">
          <button
            type="button"
            onClick={() => canEdit && setSimultaneous((v) => !v)}
            disabled={!canEdit}
            aria-pressed={simultaneous}
            className={`relative h-6 w-11 rounded-full transition shrink-0 mt-0.5 disabled:opacity-60 ${simultaneous ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${simultaneous ? "left-[22px]" : "left-0.5"}`} />
          </button>
          <div>
            <p className="text-sm font-medium">Permitir atendimentos simultâneos da mesma cliente</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ex.: escova + unha ao mesmo tempo, com profissionais diferentes. A
              profissional nunca é marcada em dois lugares; isso libera apenas a
              mesma cliente em mais de um serviço ao mesmo tempo.
            </p>
          </div>
        </div>
      </Card>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
          </Button>
          {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" /> Salvo!</span>}
        </div>
      )}
    </div>
  );
}
