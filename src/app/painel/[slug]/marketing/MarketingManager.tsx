"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import {
  ASSET_TYPES,
  FORMATS,
  STYLES,
  type AssetType,
  type Format,
  type Style,
} from "@/lib/marketing/prompts";
import type { Credits } from "@/lib/marketing/credits";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Camera,
  Check,
  CircleNotch,
  Copy,
  DownloadSimple,
  MagicWand,
  SealPercent,
  ShareNetwork,
  Sparkle,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

type Svc = { id: string; name: string; price: number; price_type: string | null };
type Camp = { id: string; name: string; discount_percent: number };

const TYPE_ICON = { SealPercent, Sparkle, Camera } as const;

type Overlay = {
  title: string;
  highlight: string;
  cta: string;
  position: "bottom" | "top";
  theme: "light" | "dark";
};

export function MarketingManager({
  slug, salon, services, campaigns, credits: initialCredits,
}: {
  slug: string;
  salon: { name: string; logoUrl: string | null; phone: string | null; colorTheme: string };
  services: Svc[];
  campaigns: Camp[];
  credits: Credits;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [credits, setCredits] = useState(initialCredits);

  // escolhas
  const [type, setType] = useState<AssetType | null>(null);
  const [serviceId, setServiceId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [note, setNote] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("story");
  const [style, setStyle] = useState<Style>("elegante");

  // resultado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUrl: string; mode: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [overlay, setOverlay] = useState<Overlay>({
    title: "", highlight: "", cta: "Agende já!", position: "bottom", theme: "light",
  });
  const [copied, setCopied] = useState(false);

  const svc = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const camp = useMemo(() => campaigns.find((c) => c.id === campaignId), [campaigns, campaignId]);
  const fmt = FORMATS.find((f) => f.id === format)!;

  function canAdvance(): boolean {
    if (step === 1) return !!type;
    if (step === 2) {
      if (type === "service") return !!serviceId;
      if (type === "promotion") return !!campaignId;
      return true; // client_work: foto é opcional no stub
    }
    return true;
  }

  function buildOverlay(): Overlay {
    let title = salon.name;
    let highlight = "";
    if (type === "service" && svc) {
      title = svc.name;
      highlight = svc.price_type === "on_request" ? "Sob consulta" : formatBRL(Number(svc.price));
    }
    if (type === "promotion" && camp) {
      title = camp.name;
      highlight = `${camp.discount_percent}% OFF`;
    }
    if (type === "client_work") {
      title = salon.name;
      highlight = "Novo visual ✨";
    }
    return { title, highlight, cta: "Agende já!", position: "bottom", theme: "light" };
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, type, style, format,
          note: note.trim() || undefined,
          serviceId: type === "service" ? serviceId : undefined,
          campaignId: type === "promotion" ? campaignId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar agora.");
        return;
      }
      setResult({ imageUrl: data.imageUrl, mode: data.mode });
      setCaption(data.caption ?? "");
      setOverlay(buildOverlay());
      if (data.credits) setCredits(data.credits);
      setStep(4);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setStep(1);
    setType(null);
    setServiceId("");
    setCampaignId("");
    setNote("");
    setPhotoName(null);
  }

  return (
    <div className="space-y-6 af-rise">
      {/* Cabeçalho + créditos */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <MagicWand className="h-6 w-6 text-primary" /> Divulgação
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie artes prontas para o status do WhatsApp, Instagram e Facebook.
          </p>
        </div>
        <CreditsBadge credits={credits} />
      </header>

      {credits.preview && (
        <Banner tone="info">
          Modo prévia: a geração por IA ainda não está conectada. Você pode testar todo o fluxo —
          as artes saem como exemplo até a chave da OpenAI ser configurada.
        </Banner>
      )}

      {!result && <Steps step={step} />}

      {error && <Banner tone="error">{error}</Banner>}

      {/* ── Passo 1: tipo ─────────────────────────────────────────── */}
      {!result && step === 1 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {ASSET_TYPES.map((t) => {
            const Icon = TYPE_ICON[t.icon as keyof typeof TYPE_ICON];
            const active = type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition",
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                )}
              >
                <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} />
                <span className="font-semibold">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Passo 2: detalhes ─────────────────────────────────────── */}
      {!result && step === 2 && (
        <Card className="space-y-4 p-5">
          {type === "promotion" && (
            <div className="space-y-2">
              <Label>Qual promoção?</Label>
              {campaigns.length === 0 ? (
                <Banner tone="info">
                  Você ainda não tem campanhas ativas. Crie uma em <b>Campanhas</b> primeiro.
                </Banner>
              ) : (
                <div className="grid gap-2">
                  {campaigns.map((c) => (
                    <RadioRow
                      key={c.id}
                      checked={campaignId === c.id}
                      onClick={() => setCampaignId(c.id)}
                      title={c.name}
                      meta={`${c.discount_percent}% de desconto`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {type === "service" && (
            <div className="space-y-2">
              <Label>Qual serviço?</Label>
              {services.length === 0 ? (
                <Banner tone="info">Cadastre um serviço em <b>Serviços</b> primeiro.</Banner>
              ) : (
                <div className="grid max-h-72 gap-2 overflow-auto">
                  {services.map((s) => (
                    <RadioRow
                      key={s.id}
                      checked={serviceId === s.id}
                      onClick={() => setServiceId(s.id)}
                      title={s.name}
                      meta={s.price_type === "on_request" ? "Sob consulta" : formatBRL(Number(s.price))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {type === "client_work" && (
            <div className="space-y-2">
              <Label>Foto do resultado (opcional na prévia)</Label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:bg-muted">
                <Camera className="h-6 w-6" />
                {photoName ?? "Toque para enviar a foto da cliente"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Lembre de ter o consentimento da cliente para divulgar a foto.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Quer destacar algo? (opcional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: válido só esta semana, edição de Dia das Mães…"
              maxLength={120}
            />
          </div>
        </Card>
      )}

      {/* ── Passo 3: formato + estilo ─────────────────────────────── */}
      {!result && step === 3 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Onde vai postar?</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-[var(--radius)] border p-4 transition",
                    format === f.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                  )}
                >
                  <span
                    className="rounded-md border border-border bg-muted"
                    style={{ aspectRatio: f.aspect, width: 38 }}
                  />
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-[11px] text-muted-foreground">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estilo visual</Label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  title={s.desc}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    style === s.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Navegação dos passos ──────────────────────────────────── */}
      {!result && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={generate} disabled={loading || credits.remaining <= 0}>
              {loading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <MagicWand className="h-4 w-4" />}
              {credits.remaining <= 0 ? "Sem créditos" : "Gerar arte"}
            </Button>
          )}
        </div>
      )}

      {/* ── Passo 4: resultado ────────────────────────────────────── */}
      {result && (
        <ResultView
          imageUrl={result.imageUrl}
          mode={result.mode}
          format={format}
          aspect={fmt.aspect}
          overlay={overlay}
          setOverlay={setOverlay}
          caption={caption}
          setCaption={setCaption}
          copied={copied}
          onCopy={() => {
            navigator.clipboard?.writeText(caption);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          onReset={reset}
          onRefresh={() => { setResult(null); setStep(3); }}
          salonName={salon.name}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Subcomponentes ───────────────────────── */

function CreditsBadge({ credits }: { credits: Credits }) {
  const low = credits.remaining <= 3;
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-right">
      <p className={cn("text-sm font-semibold", low ? "text-amber-600" : "text-foreground")}>
        {credits.remaining} {credits.remaining === 1 ? "crédito" : "créditos"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {Math.max(0, credits.monthlyQuota - credits.usedThisMonth)}/{credits.monthlyQuota} do mês
        {credits.addonBalance > 0 ? ` · +${credits.addonBalance} extras` : ""}
      </p>
      <button
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        onClick={() => alert("Compra de pacotes adicionais (+10 imagens) chega em breve.")}
      >
        Comprar +10
      </button>
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Tipo", "Detalhes", "Formato"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={l} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                active ? "bg-primary text-primary-foreground"
                  : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={cn("text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{l}</span>
            {i < labels.length - 1 && <span className="h-px flex-1 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function RadioRow({
  checked, onClick, title, meta,
}: { checked: boolean; onClick: () => void; title: string; meta: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-[var(--radius)] border px-4 py-3 text-left transition",
        checked ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
      )}
    >
      <span className="font-medium">{title}</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {meta}
        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", checked ? "border-primary bg-primary" : "border-border")}>
          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
        </span>
      </span>
    </button>
  );
}

function Banner({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius)] border p-3 text-sm",
        tone === "error"
          ? "border-red-500/30 bg-red-500/10 text-red-700"
          : "border-blue-500/30 bg-blue-500/10 text-blue-700",
      )}
    >
      <Warning className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function ResultView({
  imageUrl, mode, format, aspect, overlay, setOverlay, caption, setCaption,
  copied, onCopy, onReset, onRefresh, salonName,
}: {
  imageUrl: string;
  mode: string;
  format: Format;
  aspect: string;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  caption: string;
  setCaption: (s: string) => void;
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
  onRefresh: () => void;
  salonName: string;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  /** Compõe imagem + texto num canvas e devolve o PNG como blob. */
  async function compose(): Promise<Blob | null> {
    const [w, h] = FORMATS.find((f) => f.id === format)!.size.split("x").map(Number);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = await loadImage(imageUrl);
    ctx.drawImage(img, 0, 0, w, h);

    const bottom = overlay.position === "bottom";
    const bandH = h * 0.34;
    const bandY = bottom ? h - bandH : 0;
    const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    const dark = overlay.theme === "light";
    grad.addColorStop(bottom ? 0 : 1, dark ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)");
    grad.addColorStop(bottom ? 1 : 0, dark ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY, w, bandH);

    const text = dark ? "#ffffff" : "#161616";
    ctx.textAlign = "center";
    ctx.fillStyle = text;
    let y = bottom ? h - bandH * 0.62 : bandH * 0.30;

    ctx.font = `700 ${Math.round(w * 0.065)}px system-ui, sans-serif`;
    wrapText(ctx, overlay.title, w / 2, y, w * 0.86, w * 0.075);
    y += w * 0.12;

    if (overlay.highlight) {
      ctx.font = `800 ${Math.round(w * 0.1)}px system-ui, sans-serif`;
      ctx.fillText(overlay.highlight, w / 2, y);
      y += w * 0.1;
    }
    if (overlay.cta) {
      ctx.font = `600 ${Math.round(w * 0.045)}px system-ui, sans-serif`;
      ctx.fillText(overlay.cta, w / 2, y);
    }

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await compose();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${salonName.replace(/\s+/g, "-").toLowerCase()}-${format}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await compose();
      if (!blob) return;
      const file = new File([blob], `${format}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: caption });
      } else {
        await download();
      }
    } catch {
      /* cancelado */
    } finally {
      setBusy(false);
    }
  }

  const dark = overlay.theme === "light";

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      {/* Prévia */}
      <div className="space-y-3">
        {mode === "stub" && (
          <Banner tone="info">Exemplo: a imagem final virá da IA. O texto abaixo já é editável e real.</Banner>
        )}
        <div
          ref={previewRef}
          className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[var(--radius)] border border-border"
          style={{ aspectRatio: aspect }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Arte gerada" className="h-full w-full object-cover" />
          <div
            className={cn(
              "absolute inset-x-0 flex flex-col items-center gap-1 p-4 text-center",
              overlay.position === "bottom" ? "bottom-0 pt-16" : "top-0 pb-16",
              dark ? "text-white" : "text-neutral-900",
            )}
            style={{
              background:
                overlay.position === "bottom"
                  ? `linear-gradient(to top, ${dark ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.72)"}, transparent)`
                  : `linear-gradient(to bottom, ${dark ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.72)"}, transparent)`,
            }}
          >
            <p className="text-lg font-bold leading-tight">{overlay.title}</p>
            {overlay.highlight && <p className="text-2xl font-extrabold leading-none">{overlay.highlight}</p>}
            {overlay.cta && <p className="text-sm font-semibold">{overlay.cta}</p>}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={download} disabled={busy}>
            {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <DownloadSimple className="h-4 w-4" />} Baixar
          </Button>
          <Button variant="outline" onClick={share} disabled={busy}>
            <ShareNetwork className="h-4 w-4" /> Compartilhar
          </Button>
          <Button variant="ghost" onClick={onRefresh}>
            <ArrowsClockwise className="h-4 w-4" /> Gerar outra
          </Button>
        </div>
      </div>

      {/* Edição de texto + legenda */}
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <p className="text-sm font-semibold">Texto da arte</p>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={overlay.title} onChange={(e) => setOverlay({ ...overlay, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Destaque (preço/desconto)</Label>
            <Input value={overlay.highlight} onChange={(e) => setOverlay({ ...overlay, highlight: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Chamada</Label>
            <Input value={overlay.cta} onChange={(e) => setOverlay({ ...overlay, cta: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <MiniToggle
              label="Posição"
              value={overlay.position === "bottom" ? "Embaixo" : "Em cima"}
              onClick={() => setOverlay({ ...overlay, position: overlay.position === "bottom" ? "top" : "bottom" })}
            />
            <MiniToggle
              label="Texto"
              value={overlay.theme === "light" ? "Claro" : "Escuro"}
              onClick={() => setOverlay({ ...overlay, theme: overlay.theme === "light" ? "dark" : "light" })}
            />
          </div>
        </Card>

        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Legenda pronta</p>
            <button onClick={onCopy} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
            </button>
          </div>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} />
        </Card>

        <Button variant="ghost" className="w-full" onClick={onReset}>
          Começar do zero
        </Button>
      </div>
    </div>
  );
}

function MiniToggle({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-[var(--radius)] border border-border px-3 py-2 text-left text-xs hover:bg-muted"
    >
      <span className="block text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </button>
  );
}

/* ───────────────────────── helpers de canvas ───────────────────────── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}
