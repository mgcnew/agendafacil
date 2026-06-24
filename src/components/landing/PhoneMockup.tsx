"use client";

import { useEffect, useState } from "react";
import { NICHE_LIST, patternClass, type Niche } from "@/lib/themes";
import { formatBRL } from "@/lib/utils";
import {
  Clock,
  SealCheck,
  Star,
} from "@phosphor-icons/react/dist/ssr";

const DEMO: Record<Niche, { name: string; services: [string, number, number][] }> = {
  feminino: {
    name: "Studio Bella",
    services: [["Corte & Escova", 45, 70], ["Coloração", 90, 180], ["Manicure", 40, 45]],
  },
  barbearia: {
    name: "Navalha & Cia",
    services: [["Corte Masculino", 35, 45], ["Barba", 30, 35], ["Corte + Barba", 60, 70]],
  },
  estetica: {
    name: "Lótus Estética",
    services: [["Sobrancelha", 30, 45], ["Limpeza de Pele", 60, 130], ["Cílios", 90, 180]],
  },
  neutro: {
    name: "Espaço Bem-Estar",
    services: [["Atendimento", 45, 80], ["Pacote Premium", 90, 160], ["Express", 30, 50]],
  },
};

export function PhoneMockup() {
  const [i, setI] = useState(0);
  const niche = NICHE_LIST[i].id;
  const meta = NICHE_LIST[i];
  const demo = DEMO[niche];

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % NICHE_LIST.length), 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* formas decorativas sólidas (sem blur pesado) */}
      <div className="absolute -z-10 -right-5 -top-6 h-32 w-32 rounded-full bg-secondary" aria-hidden />
      <div
        className="absolute -z-10 -left-7 bottom-16 h-24 w-24 rounded-[1.75rem] rotate-12 bg-accent/15"
        aria-hidden
      />

      {/* dispositivo neutro claro */}
      <div className="rounded-[2.5rem] bg-card border border-border p-2.5 shadow-[0_28px_60px_-26px_rgba(15,30,27,0.4)]">
        <div
          key={niche}
          data-theme={niche}
          className="af-rise rounded-[2rem] overflow-hidden bg-background"
        >
          {/* topo com câmera */}
          <div className="relative h-5 bg-background">
            <div className="absolute left-1/2 -translate-x-1/2 top-2 h-1.5 w-1.5 rounded-full bg-foreground/25" />
          </div>

          {/* hero do salão */}
          <div
            className="relative mx-3 rounded-[var(--radius)] p-4 text-white overflow-hidden"
            style={{ background: meta.gradient }}
          >
            <div className={`${patternClass(meta.pattern)} absolute inset-0 opacity-20`} />
            <div className="relative">
              <p className="text-[9px] uppercase tracking-[0.2em] opacity-80">{meta.tagline}</p>
              <p className="font-display text-2xl leading-tight mt-0.5">{demo.name}</p>
              <div className="flex items-center gap-1 mt-1 text-[11px]">
                <Star className="h-3 w-3 fill-current" /> 4,9 · agende em segundos
              </div>
            </div>
          </div>

          {/* serviços */}
          <div className="p-3 space-y-2">
            {demo.services.map(([name, min, price]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card p-2.5"
              >
                <div>
                  <p className="text-[12px] font-medium text-card-foreground leading-tight">{name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> {min} min
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-primary tabular-nums">
                  {formatBRL(price)}
                </span>
              </div>
            ))}
            <div
              className="mt-1 h-9 rounded-[var(--radius)] grid place-items-center text-[12px] font-medium text-primary-foreground"
              style={{ background: "var(--primary)" }}
            >
              Escolher horário
            </div>
          </div>
        </div>
      </div>

      {/* selo flutuante de credibilidade (tema da marca, neutro) */}
      <div className="absolute -bottom-3 -left-3 flex items-center gap-2 rounded-2xl bg-card border border-border shadow-card px-3 py-2">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-primary/10 text-primary">
          <SealCheck className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold">Agendamento confirmado</p>
          <p className="text-[10px] text-muted-foreground">há instantes</p>
        </div>
      </div>

      {/* indicador de tema */}
      <div className="flex items-center justify-center gap-2 mt-7">
        {NICHE_LIST.map((n, idx) => (
          <button
            key={n.id}
            onClick={() => setI(idx)}
            aria-label={`Ver tema ${n.label}`}
            className="h-2 rounded-full transition-all"
            style={{
              width: idx === i ? 22 : 8,
              background: idx === i ? n.swatch : "var(--muted-foreground)",
              opacity: idx === i ? 1 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
