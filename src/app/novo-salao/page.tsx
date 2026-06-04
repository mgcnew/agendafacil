"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { NICHE_LIST, type Niche } from "@/lib/themes";
import { formatBRL } from "@/lib/utils";
import { Scissors, Loader2, Check, Clock } from "lucide-react";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function NovoSalaoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [niche, setNiche] = useState<Niche>("feminino");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => NICHE_LIST.find((n) => n.id === niche)!, [niche]);
  const effectiveSlug = slugEdited ? slug : slugify(name);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_salon", {
      p_name: name,
      p_slug: effectiveSlug,
      p_niche: niche,
    });
    if (error) {
      setError(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "Esse link já está em uso. Escolha outro."
          : error.message,
      );
      setLoading(false);
      return;
    }
    const salon = Array.isArray(data) ? data[0] : data;
    router.push(`/painel/${salon.slug}`);
    router.refresh();
  }

  return (
    <div className="min-h-full px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 font-display font-bold text-xl mb-8">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <Scissors className="h-5 w-5" />
          </span>
          AgendeFácil
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
          <Card className="p-8">
            <h1 className="font-display text-2xl font-bold">Vamos criar seu salão</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Você pode mudar tudo isso depois nas configurações.
            </p>

            <form onSubmit={onSubmit} className="space-y-5 mt-7">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do salão</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Studio Bella"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Link de agendamento</Label>
                <div className="flex items-center rounded-[var(--radius)] border border-border bg-card overflow-hidden">
                  <span className="px-3 text-sm text-muted-foreground bg-muted h-11 flex items-center">
                    agendefacil.app/
                  </span>
                  <input
                    id="slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="studio-bella"
                    className="flex-1 h-11 px-3 text-sm bg-transparent focus:outline-none"
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
                        className={`relative text-left rounded-[var(--radius)] border p-4 transition ${
                          active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/20"
                        }`}
                      >
                        {active && (
                          <Check className="absolute top-3 right-3 h-4 w-4 text-primary" />
                        )}
                        <span
                          className="inline-block h-4 w-4 rounded-full mb-2"
                          style={{ background: n.swatch }}
                        />
                        <p className="font-semibold text-sm">{n.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.tagline}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" size="lg" disabled={loading || !name}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar salão
              </Button>
            </form>
          </Card>

          {/* Preview ao vivo */}
          <div data-theme={niche} className="rounded-[var(--radius)] bg-background border border-border p-6 shadow-xl sticky top-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Prévia do seu app
            </p>
            <div
              className="rounded-[var(--radius)] p-5 text-white relative overflow-hidden"
              style={{ background: meta.gradient }}
            >
              <div className="af-grain absolute inset-0 opacity-30" />
              <p className="relative font-display text-2xl font-bold">
                {name || "Seu Salão"}
              </p>
              <p className="relative text-sm opacity-80">{meta.tagline}</p>
            </div>
            <div className="space-y-2 mt-4">
              {meta.examples.slice(0, 3).map((svc, i) => (
                <div key={svc} className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{svc}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {30 + i * 15} min
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatBRL(45 + i * 25)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
