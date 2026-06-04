"use client";

import { useState } from "react";
import { NICHE_LIST, type Niche } from "@/lib/themes";
import { formatBRL } from "@/lib/utils";
import { Clock, Star } from "lucide-react";

export function NicheShowcase() {
  const [active, setActive] = useState<Niche>("feminino");
  const meta = NICHE_LIST.find((n) => n.id === active)!;

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
      {/* Seletor de nicho */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Um tema para cada negócio
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 leading-tight">
          A cara do seu salão, automaticamente.
        </h2>
        <p className="text-muted-foreground mt-4 max-w-md">
          Escolha o seu segmento e veja o app de agendamento se transformar — cores,
          tipografia e clima combinando com o seu público.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-8">
          {NICHE_LIST.map((n) => {
            const isActive = n.id === active;
            return (
              <button
                key={n.id}
                onClick={() => setActive(n.id)}
                className={`text-left rounded-2xl border p-4 transition-all duration-300 ${
                  isActive
                    ? "border-transparent shadow-lg scale-[1.02]"
                    : "border-border bg-card hover:border-foreground/20"
                }`}
                style={
                  isActive
                    ? { background: n.gradient, color: "#fff" }
                    : undefined
                }
              >
                <span
                  className="inline-block h-3 w-3 rounded-full mb-2"
                  style={{ background: isActive ? "#fff" : n.swatch }}
                />
                <p className="font-semibold">{n.label}</p>
                <p
                  className={`text-xs mt-0.5 ${isActive ? "text-white/80" : "text-muted-foreground"}`}
                >
                  {n.tagline}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview do app no tema selecionado */}
      <div
        data-theme={active}
        className="rounded-[var(--radius)] border border-border bg-background p-5 sm:p-7 shadow-2xl transition-all duration-500"
      >
        <div
          className="rounded-[var(--radius)] p-5 text-white relative overflow-hidden"
          style={{ background: meta.gradient }}
        >
          <div className="af-grain absolute inset-0 opacity-30" />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest opacity-80">
              {meta.tagline}
            </p>
            <p className="font-display text-2xl font-bold mt-1">
              Studio {meta.label.split(" ")[0]}
            </p>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <Star className="h-4 w-4 fill-current" />
              <span>4,9 · agende em segundos</span>
            </div>
          </div>
        </div>

        <p className="font-display text-lg font-semibold mt-5 mb-3">
          Serviços
        </p>
        <div className="space-y-2.5">
          {meta.examples.map((svc, i) => (
            <div
              key={svc}
              className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card p-3.5"
            >
              <div>
                <p className="font-medium text-card-foreground">{svc}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> {30 + i * 15} min
                </p>
              </div>
              <span className="font-semibold text-primary">
                {formatBRL(45 + i * 25)}
              </span>
            </div>
          ))}
        </div>

        <button
          className="mt-5 w-full h-12 rounded-[var(--radius)] font-medium text-primary-foreground transition active:scale-[0.98]"
          style={{ background: "var(--primary)" }}
        >
          Escolher horário
        </button>
      </div>
    </div>
  );
}
