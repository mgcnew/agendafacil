"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { CHOOSABLE_NICHES, COLOR_GROUPS, patternClass, type Niche, type ColorTheme } from "@/lib/themes";
import { SERVICE_PRESETS } from "@/lib/servicePresets";
import type { TablesUpdate } from "@/lib/database.types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleNotch,
  Clock,
  MapPin,
  Phone,
  Plus,
  Scissors,
  Sparkle,
  Star,
  Storefront,
  UploadSimple,
  UsersThree,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react/dist/ssr";

// Cargos de convite — mesmos da aba Equipe (member_role, sem "owner").
const ROLE_LABEL: Record<string, string> = {
  manager: "Gerente",
  professional: "Profissional",
  receptionist: "Recepção",
};
const ROLE_OPTIONS = ["manager", "professional", "receptionist"] as const;

async function compressImage(file: File, maxDim = 512, quality = 0.9): Promise<File> {
  try {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("decode"));
      i.src = dataUrl;
    });
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

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

const STEPS = ["Seu salão", "Contato", "Sua marca", "Serviços", "Horários", "Equipe"];

export default function NovoSalaoPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [niche, setNiche] = useState<Niche>("feminino");
  const [colorTheme, setColorTheme] = useState<ColorTheme>("a");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passo Equipe: dono escolhe se trabalha sozinho ou já convida o 1º funcionário.
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [empEmail, setEmpEmail] = useState("");
  const [empRole, setEmpRole] = useState<string>("professional");
  const [empCommission, setEmpCommission] = useState("");
  // Ao terminar com convite gerado, mostramos a tela de "mandar pelo WhatsApp"
  // em vez de já jogar pro painel — o dono decide quando enviar.
  const [done, setDone] = useState<{ slug: string; token: string; email: string } | null>(null);

  const meta = useMemo(() => CHOOSABLE_NICHES.find((n) => n.id === niche)!, [niche]);

  // presets do nicho agrupados por categoria
  const presetGroups = useMemo(() => {
    const acc: Record<string, { name: string; duration: number }[]> = {};
    for (const p of SERVICE_PRESETS[niche] ?? []) (acc[p.category] ??= []).push(p);
    return acc;
  }, [niche]);

  // ao escolher/trocar o nicho, pré-seleciona todos os serviços comuns dele
  useEffect(() => {
    setSelectedServices(new Set((SERVICE_PRESETS[niche] ?? []).map((p) => p.name)));
  }, [niche]);

  function toggleSvc(name: string) {
    setSelectedServices((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  }
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

      // contato / endereço / tema de cor
      const patch: TablesUpdate<"salons"> = { color_theme: colorTheme };
      if (phone) patch.phone = phone;
      if (address) patch.address = address;

      // logo — comprime para WebP antes de subir
      if (logoFile) {
        const compressed = await compressImage(logoFile);
        const path = `${salon.id}.webp`;
        const up = await supabase.storage
          .from("logos")
          .upload(path, compressed, { upsert: true, contentType: "image/webp" });
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

      // serviços iniciais (presets escolhidos)
      const svcRows = (SERVICE_PRESETS[niche] ?? [])
        .filter((p) => selectedServices.has(p.name))
        .map((p) => ({ salon_id: salon.id, name: p.name, duration_min: p.duration, price: 0 }));
      if (svcRows.length) await supabase.from("services").insert(svcRows);

      // 1º funcionário (opcional): gera o convite já aqui pra o dono mandar no
      // WhatsApp. Falha no convite não derruba o cadastro — o salão já existe.
      if (hasTeam && empEmail.trim()) {
        const { data: invData, error: invErr } = await supabase.rpc("create_invite", {
          p_salon: salon.id,
          p_email: empEmail.trim(),
          p_role: empRole as "manager" | "professional" | "receptionist",
          p_commission: Number(empCommission.replace(",", ".")) || 0,
        });
        const inv = (Array.isArray(invData) ? invData[0] : invData) as { token?: string } | null;
        if (!invErr && inv?.token) {
          setDone({ slug: salon.slug, token: inv.token, email: empEmail.trim() });
          setLoading(false);
          return; // mostra a tela de "enviar convite", sem redirecionar
        }
      }

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

  function shareInviteWhatsApp() {
    if (!done) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/convite/${done.token}`;
    const msg = `Olá! Você foi convidado(a) para a equipe do ${name} 💈\nCrie seu acesso por aqui: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  // Tela final quando o dono já convidou o 1º funcionário — ele decide quando
  // mandar pelo WhatsApp e então entra no painel.
  if (done) {
    return (
      <div className="min-h-dvh grid place-items-center px-5 py-10">
        <div className="w-full max-w-md af-rise rounded-[var(--radius)] border border-border bg-card shadow-card p-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <UsersThree className="h-7 w-7" weight="fill" />
          </span>
          <h1 className="font-display text-2xl mt-4">Salão criado! 🎉</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Convite de <b className="text-foreground">{done.email}</b> pronto. Mande o link pelo
            WhatsApp para a pessoa criar o acesso — ou faça isso depois na aba <b>Equipe</b>.
          </p>
          <div className="mt-6 space-y-2.5">
            <Button size="lg" className="w-full" onClick={shareInviteWhatsApp}>
              <WhatsappLogo className="h-5 w-5" weight="fill" /> Enviar convite pelo WhatsApp
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { router.push(`/painel/${done.slug}`); router.refresh(); }}
            >
              Ir para o painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-5 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 font-display font-bold text-xl mb-8">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <Scissors className="h-5 w-5" />
          </span>
          Zulan
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
                  <h1 className="font-display text-2xl">Vamos montar seu salão juntos</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Faço umas perguntas rápidas e já deixo tudo pronto pra você. Começando pelo básico:
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome do salão</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio Bella" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Link de agendamento</Label>
                  <div className="flex items-center rounded-[var(--radius)] border border-border bg-card overflow-hidden">
                    <span className="px-3 text-sm text-muted-foreground bg-muted h-11 flex items-center whitespace-nowrap">
                      zulan.app/
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
                  <Label>Segmento</Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {CHOOSABLE_NICHES.map((n) => {
                      const active = n.id === niche;
                      return (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => { setNiche(n.id); setColorTheme("a"); }}
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

                {/* Paleta de cores — 12 opções em 3 grupos (compartilhadas) */}
                <div className="space-y-3">
                  <Label>Paleta de cores</Label>
                  {COLOR_GROUPS.map((group) => (
                    <div key={group.id} className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {group.variants.map((v) => {
                          const active = v.id === colorTheme;
                          return (
                            <button
                              type="button"
                              key={v.id}
                              onClick={() => setColorTheme(v.id)}
                              aria-pressed={active}
                              title={v.label}
                              className={`group relative overflow-hidden rounded-[var(--radius)] border transition ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/25"}`}
                            >
                              <div
                                className="flex h-10 items-center justify-center gap-1.5"
                                style={{ background: v.background }}
                              >
                                <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: v.primary }} />
                                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: v.accent }} />
                              </div>
                              <div className="flex items-center justify-center gap-1 bg-card px-1 py-1">
                                <span className="text-[10px] font-medium leading-tight text-center truncate">{v.label}</span>
                                {active && <Check className="h-3 w-3 text-primary shrink-0" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                      <Storefront className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius)] border border-border bg-card hover:bg-muted cursor-pointer text-sm font-medium transition">
                      <UploadSimple className="h-4 w-4" /> Escolher imagem
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

            {/* STEP 3 — serviços */}
            {step === 3 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl flex items-center gap-2">
                    <Sparkle className="h-5 w-5 text-primary" /> Serviços que você oferece
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Marque os principais — já deixamos os mais comuns selecionados. Preço e novos serviços você ajusta depois.
                  </p>
                </div>
                <div className="space-y-4">
                  {Object.entries(presetGroups).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((p) => {
                          const on = selectedServices.has(p.name);
                          return (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => toggleSvc(p.name)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                                on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground/30"
                              }`}
                            >
                              {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4 — horários */}
            {step === 4 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl">Horário de funcionamento</h1>
                  <p className="text-sm text-muted-foreground mt-1">É o que define os horários livres no link da cliente.</p>
                </div>
                <div className="space-y-2">
                  {hours.map((d) => (
                    <div key={d.weekday} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-[var(--radius)] border border-border p-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDay(d.weekday, { enabled: !d.enabled })}
                          className={`relative h-6 w-11 rounded-full transition shrink-0 ${d.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                          aria-label={`Alternar ${WEEKDAYS[d.weekday]}`}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${d.enabled ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                        <span className="w-10 text-sm font-medium">{WEEKDAYS[d.weekday]}</span>
                        {!d.enabled && (
                          <span className="ml-auto text-sm text-muted-foreground sm:hidden">Fechado</span>
                        )}
                      </div>
                      {d.enabled ? (
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <input type="time" value={d.start} onChange={(e) => setDay(d.weekday, { start: e.target.value })} className="h-10 sm:h-9 flex-1 sm:flex-none sm:w-28 min-w-0 rounded-[var(--radius)] border border-border bg-card px-2 text-sm" />
                          <span className="text-muted-foreground text-sm shrink-0">às</span>
                          <input type="time" value={d.end} onChange={(e) => setDay(d.weekday, { end: e.target.value })} className="h-10 sm:h-9 flex-1 sm:flex-none sm:w-28 min-w-0 rounded-[var(--radius)] border border-border bg-card px-2 text-sm" />
                        </div>
                      ) : (
                        <span className="ml-auto hidden text-sm text-muted-foreground sm:block">Fechado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5 — equipe (opcional) */}
            {step === 5 && (
              <div className="space-y-5 af-rise">
                <div>
                  <h1 className="font-display text-2xl flex items-center gap-2">
                    <UsersThree className="h-5 w-5 text-primary" /> Você tem equipe?
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Se trabalha com mais gente, já deixo o primeiro convite pronto pra você mandar no WhatsApp.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHasTeam(false)}
                    aria-pressed={hasTeam === false}
                    className={`rounded-[var(--radius)] border p-4 text-left transition ${hasTeam === false ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/20"}`}
                  >
                    <p className="font-semibold text-sm">Trabalho sozinho(a)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Posso convidar gente depois.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasTeam(true)}
                    aria-pressed={hasTeam === true}
                    className={`rounded-[var(--radius)] border p-4 text-left transition ${hasTeam === true ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/20"}`}
                  >
                    <p className="font-semibold text-sm">Tenho equipe</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Convidar o primeiro agora.</p>
                  </button>
                </div>

                {hasTeam && (
                  <div className="space-y-4 af-rise rounded-[var(--radius)] border border-border p-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="empEmail">E-mail da pessoa</Label>
                      <Input id="empEmail" type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} placeholder="funcionaria@email.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="empRole">Cargo</Label>
                        <Select id="empRole" value={empRole} onValueChange={setEmpRole}>
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="empCommission">Comissão geral (%)</Label>
                        <Input id="empCommission" inputMode="decimal" value={empCommission} onChange={(e) => setEmpCommission(e.target.value)} placeholder="0" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A pessoa recebe um link, cria a conta e preenche os próprios dados. Você ajusta
                      horários e comissões quando quiser, na aba <b>Equipe</b>.
                    </p>
                  </div>
                )}
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
                  {loading && <CircleNotch className="h-4 w-4 animate-spin" />}
                  {hasTeam && empEmail.trim() ? "Criar salão e convidar" : "Criar salão"}
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
