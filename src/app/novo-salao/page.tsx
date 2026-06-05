"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { NICHE_LIST, patternClass, type Niche } from "@/lib/themes";
import type { TablesUpdate } from "@/lib/database.types";
import {
  Scissors, Loader2, Check, Clock, Upload, Phone, MapPin,
  ArrowLeft, ArrowRight, Store, Star, X,
} from "lucide-react";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type DayHours = { weekday: number; enabled: boolean; start: string; end: string };
const DEFAULT_HOURS: DayHours[] = WEEKDAYS.map((_, w) => ({
  weekday: w,
  enabled: w >= 1 && w <= 6, // seg–sáb
  start: "09:00",
  end: "18:00",
}));

const STEPS = ["Seu salão", "Contato", "Sua marca", "Horários"];

export default function NovoSalaoPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [niche, setNiche] = useState<Niche>("feminino");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => NICHE_LIST.find((n) => n.id === niche)!, [niche]);
  const effectiveSlug = slugEdited ? slug : slugify(name);

  function pickLogo(file: File | null) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoFile(null);
      setLogoPreview(null);
    }
  }

  function setDay(w: number, patch: Partial<DayHours>) {
    setHours((h) => h.map((d) => (d.weekday === w ? { ...d, ...patch } : d)));
  }

  const canContinue = step === 0 ? name.trim().length > 0 && effectiveSlug.length > 0 : true;

  async function finish() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("create_salon", {
        p_name: name,
        p_slug: effectiveSlug,
        p_niche: niche,
      });
      if (error) throw error;
      const salon = Array.isArray(data) ? data[0] : data;

      // contato / endereço
      const patch: TablesUpdate<"salons"> = {};
      if (phone) patch.phone = phone;
      if (address) patch.address = address;

      // logo
      if (logoFile) {
        const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
        const path = `${salon.id}.${ext}`;
        const up = await supabase.storage
          .from("logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (!up.error) {
          const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
          patch.logo_url = pub.publicUrl;
        }
      }

      if (Object.keys(patch).length) {
        await supabase.from("salons").update(patch).eq("id", salon.id);
      }

      // horários
      const rows = hours
        .filter((d) => d.enabled && d.start < d.end)
        .map((d) => ({
          salon_id: salon.id,
          member_id: null,
          weekday: d.weekday,
          start_time: d.start,
          end_time: d.end,
        }));
      if (rows.length) await supabase.from("working_hours").insert(rows);

      router.push(`/painel/${salon.slug}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("duplicate") || msg.includes("unique")
          ? "Esse link já está em uso. Volte ao passo 1 e escolha outro."
          : "Não foi possível criar o salão. Tente novamente.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh px-5 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 font-display font-bold text-xl mb-8">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <Scissors className="h-5 w-5" />
          </span>
          AgendeFácil
        </div>

        <div className="grid lg:grid-cols-[1.25fr_1fr] gap-8 items-start">
          {/* Wizard */}
          <div className="rounded-[var(--radius)] border border-border bg-card shadow-card p-6 sm:p-8">
            {/* Progresso */}
            <div className="flex items-center gap-1.5 mb-7">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full transition ${i <= step ? "bg-primary" : "bg-muted"}`} />
                  <p className={`text-[11px] mt-1.5 ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</p>
                </div>
              ))}
            </div>

            {/* STEP 0 — dados */}
            {step === 0 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl">Vamos criar seu salão</h1>
                  <p className="text-sm text-muted-foreground mt-1">Comece pelo essencial.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome do salão</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio Bella" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Link de agendamento</Label>
                  <div className="flex items-center rounded-[var(--radius)] border border-border bg-card overflow-hidden">
                    <span className="px-3 text-sm text-muted-foreground bg-muted h-11 flex items-center whitespace-nowrap">
                      agendefacil.app/
                    </span>
                    <input
                      id="slug"
                      value={effectiveSlug}
                      onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)); }}
                      placeholder="studio-bella"
                      className="flex-1 h-11 px-3 text-sm bg-transparent focus:outline-none min-w-0"
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <Label>Segmento (define o tema visual)</Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {NICHE_LIST.map((n) => {
                      const active = n.id === niche;
                      return (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => setNiche(n.id)}
                          className={`relative text-left rounded-[var(--radius)] border p-4 transition ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/20"}`}
                        >
                          {active && <Check className="absolute top-3 right-3 h-4 w-4 text-primary" />}
                          <span className="inline-block h-4 w-4 rounded-full mb-2" style={{ background: n.swatch }} />
                          <p className="font-semibold text-sm">{n.label}</p>
                          <p className="text-xs text-muted-foreground">{n.tagline}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 — contato */}
            {step === 1 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl">Contato e endereço</h1>
                  <p className="text-sm text-muted-foreground mt-1">Aparecem na sua página de agendamento.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">WhatsApp / Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Endereço</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número — bairro, cidade" className="pl-9" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Pode pular e preencher depois nas configurações.</p>
              </div>
            )}

            {/* STEP 2 — logo */}
            {step === 2 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl">Sua marca</h1>
                  <p className="text-sm text-muted-foreground mt-1">Envie a logo do salão (opcional).</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="grid place-items-center h-24 w-24 rounded-2xl border border-border bg-muted overflow-hidden shrink-0">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Prévia da logo" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius)] border border-border bg-card hover:bg-muted cursor-pointer text-sm font-medium transition">
                      <Upload className="h-4 w-4" /> Escolher imagem
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {logoPreview && (
                      <button onClick={() => pickLogo(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600">
                        <X className="h-3.5 w-3.5" /> Remover
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG ou JPG, formato quadrado de preferência.</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — horários */}
            {step === 3 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl">Horário de funcionamento</h1>
                  <p className="text-sm text-muted-foreground mt-1">É o que define os horários livres no link da cliente.</p>
                </div>
                <div className="space-y-2">
                  {hours.map((d) => (
                    <div key={d.weekday} className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-2.5">
                      <button
                        type="button"
                        onClick={() => setDay(d.weekday, { enabled: !d.enabled })}
                        className={`relative h-6 w-11 rounded-full transition shrink-0 ${d.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                        aria-label={`Alternar ${WEEKDAYS[d.weekday]}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${d.enabled ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                      <span className="w-10 text-sm font-medium">{WEEKDAYS[d.weekday]}</span>
                      {d.enabled ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <input type="time" value={d.start} onChange={(e) => setDay(d.weekday, { start: e.target.value })} className="h-9 rounded-[var(--radius)] border border-border bg-card px-2 text-sm" />
                          <span className="text-muted-foreground text-sm">às</span>
                          <input type="time" value={d.end} onChange={(e) => setDay(d.weekday, { end: e.target.value })} className="h-9 rounded-[var(--radius)] border border-border bg-card px-2 text-sm" />
                        </div>
                      ) : (
                        <span className="ml-auto text-sm text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

            {/* Navegação */}
            <div className="flex items-center gap-3 mt-7">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={loading}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button className="ml-auto" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="ml-auto" size="lg" onClick={finish} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar salão
                </Button>
              )}
            </div>
          </div>

          {/* Preview ao vivo */}
          <div data-theme={niche} className="rounded-[var(--radius)] bg-background border border-border shadow-card p-6 sticky top-6">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Prévia do seu app</p>
            <div className="relative rounded-[var(--radius)] p-5 text-white overflow-hidden" style={{ background: meta.gradient }}>
              <div className={`${patternClass(meta.pattern)} absolute inset-0 opacity-20`} />
              <div className="relative flex items-center gap-3">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="" className="h-12 w-12 rounded-xl object-cover border border-white/30" />
                ) : null}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">{meta.tagline}</p>
                  <p className="font-display text-2xl leading-tight">{name || "Seu Salão"}</p>
                </div>
              </div>
              <div className="relative flex items-center gap-1 mt-2 text-xs opacity-90">
                <Star className="h-3 w-3 fill-current" /> agende em segundos
              </div>
            </div>

            {(phone || address) && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {phone}</p>}
                {address && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {address}</p>}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {hours.filter((d) => d.enabled).length} dia(s) de atendimento
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
