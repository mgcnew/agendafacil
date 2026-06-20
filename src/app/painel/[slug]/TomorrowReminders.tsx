"use client";

import { Card } from "@/components/ui";
import { BellRing, MessageCircle } from "lucide-react";

export type ReminderItem = {
  id: string;
  time: string;
  client: string;
  phone: string | null;
  services: string[];
};

const firstName = (n: string) => (n || "").trim().split(" ")[0] || "";

export function TomorrowReminders({
  items,
  dateLabel,
  salonName,
}: {
  items: ReminderItem[];
  dateLabel: string;
  salonName: string;
}) {
  const waHref = (it: ReminderItem) => {
    const digits = (it.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    const svc = it.services.length ? ` — ${it.services.join(", ")}` : "";
    const msg = `Oi, ${firstName(it.client)}! 😊 Passando pra lembrar do seu horário amanhã (${dateLabel}) às ${it.time}${svc}, aqui no ${salonName}. Posso confirmar? 💜`;
    return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <Card className="p-4 min-w-0">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <BellRing className="h-4 w-4 text-primary" /> Lembretes de amanhã
        <span className="text-xs font-normal text-muted-foreground">{dateLabel}</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum agendamento para amanhã.</p>
      ) : (
      <div className="space-y-2">
        {items.map((it) => {
          const href = waHref(it);
          return (
            <div
              key={it.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius)] border border-border p-3"
            >
              <span className="font-display font-bold tabular-nums text-sm w-12 shrink-0">{it.time}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{it.client}</p>
                {it.services.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">{it.services.join(", ")}</p>
                )}
              </div>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 shrink-0 rounded-[var(--radius)] bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Lembrar
                </a>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">sem telefone</span>
              )}
            </div>
          );
        })}
      </div>
      )}
    </Card>
  );
}
