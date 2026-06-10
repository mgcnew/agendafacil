"use client";

import { useState } from "react";
import { formatBRL, formatDuration } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";

// Status = ponto colorido + texto em token (legível em qualquer tema).
const STATUS: Record<string, { label: string; dot: string }> = {
  pending: { label: "Aguardando", dot: "#f59e0b" },
  confirmed: { label: "Confirmado", dot: "#10b981" },
  in_progress: { label: "Em andamento", dot: "#3b82f6" },
  completed: { label: "Concluído", dot: "#9ca3af" },
  cancelled: { label: "Cancelado", dot: "#ef4444" },
  no_show: { label: "Faltou", dot: "#e11d48" },
};

export type AgendaService = { name: string; price: number; duration: number };
export type AgendaItem = {
  id: string;
  time: string;
  client: string;
  alert: string | null;
  prof: string;
  status: string;
  price: number;
  services: AgendaService[];
};

export function TodayAgenda({ items }: { items: AgendaItem[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-2">
      {items.map((a) => {
        const st = STATUS[a.status] ?? STATUS.pending;
        const isOpen = open.has(a.id);
        return (
          <div key={a.id} className="rounded-[var(--radius)] border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(a.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 sm:gap-4 p-4 text-left transition hover:bg-muted/40"
            >
              <div className="text-center shrink-0">
                <p className="font-display font-bold">{a.time}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate flex items-center gap-2">
                  {a.client}
                  {a.alert && (
                    <span
                      title={a.alert}
                      className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 px-2 py-0.5 text-[10px] font-medium shrink-0"
                    >
                      <AlertTriangle className="h-3 w-3" /> alerta
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {a.prof}
                  {a.services.length > 0 && (
                    <>
                      {a.prof ? " · " : ""}
                      {a.services.length} serviço{a.services.length === 1 ? "" : "s"}
                    </>
                  )}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-muted px-2.5 py-1 font-medium text-foreground/75 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
                <span className="hidden sm:inline">{st.label}</span>
              </span>
              <span className="font-semibold text-primary text-sm shrink-0">{formatBRL(a.price)}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                {a.services.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum serviço especificado neste agendamento.</p>
                ) : (
                  a.services.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="text-muted-foreground">{formatDuration(s.duration)}</span>
                        <span className="font-medium text-foreground tabular-nums">{formatBRL(s.price)}</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
