"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, UserCircle } from "@phosphor-icons/react/dist/ssr";

export type TVItem = {
  id: string;
  starts_at: string;
  time: string;
  client: string;
  prof: string;
  status: string;
  services: string[];
};

const REFRESH_MS = 45_000;

/**
 * Tela pensada pra ficar espelhada num monitor da recepção — sem menu, sem
 * nada clicável, letras grandes pra ler de longe. Se atualiza sozinha (não
 * é tempo real: recarrega os dados do servidor a cada ~45s).
 */
export function AgendaTV({ items, salonName }: { items: TVItem[]; salonName: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clockId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockId);
  }, []);

  useEffect(() => {
    const refreshId = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(refreshId);
  }, [router]);

  const upcoming = useMemo(() => {
    const nowMs = now.getTime();
    return items
      .filter(
        (a) =>
          (new Date(a.starts_at).getTime() >= nowMs || a.status === "in_progress") &&
          !["completed", "cancelled", "no_show"].includes(a.status),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [items, now]);

  const [next, ...rest] = upcoming;

  const dateLabel = now.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
  });
  const timeLabel = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="min-h-screen flex flex-col p-10">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <h1 className="font-display text-4xl font-bold">{salonName}</h1>
        <div className="text-right">
          <p className="font-display text-5xl font-bold tabular-nums">{timeLabel}</p>
          <p className="text-lg text-muted-foreground capitalize mt-1">{dateLabel}</p>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 mt-10">
        {upcoming.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-2xl text-muted-foreground">Agenda livre por enquanto.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Próximo/em andamento — destaque */}
            <div className="rounded-[var(--radius)] border-2 border-primary bg-primary/5 p-8 flex items-center gap-8">
              <div className="shrink-0">
                <p className="text-sm font-semibold text-primary uppercase tracking-wide">
                  {next.status === "in_progress" ? "Em andamento" : "A seguir"}
                </p>
                <p className="font-display text-6xl font-bold tabular-nums mt-1">{next.time}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-4xl font-bold truncate">{next.client}</p>
                <div className="flex items-center gap-2 mt-2 text-xl text-muted-foreground">
                  {next.prof && (
                    <span className="flex items-center gap-1.5">
                      <UserCircle className="h-6 w-6" /> {next.prof}
                    </span>
                  )}
                  {next.services.length > 0 && (
                    <span className="truncate">{next.prof ? "· " : ""}{next.services.join(", ")}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Fila dos seguintes */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {rest.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-6 rounded-[var(--radius)] border border-border bg-card px-6 py-4"
                  >
                    <p className="font-display text-2xl font-bold tabular-nums w-20 shrink-0">{it.time}</p>
                    <p className="text-xl font-medium truncate flex-1 min-w-0">{it.client}</p>
                    <p className="text-lg text-muted-foreground truncate shrink-0 max-w-[40%] text-right">
                      {[it.prof, it.services.join(", ")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 justify-center text-xs text-muted-foreground/60 mt-8">
        <Clock className="h-3.5 w-3.5" /> Atualiza automaticamente
      </p>
    </div>
  );
}
