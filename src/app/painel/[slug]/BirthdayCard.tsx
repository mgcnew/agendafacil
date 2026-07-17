"use client";

import { Card } from "@/components/ui";
import {
  Cake,
  ChatCircle,
} from "@phosphor-icons/react/dist/ssr";

export type BirthdayClient = {
  id: string;
  name: string;
  phone: string | null;
  days_until: number;
  turning_age: number;
};

// URL canônica (produção) — vai dentro da mensagem de WhatsApp, então nunca
// pode ser "localhost". NEXT_PUBLIC_ é embutida no build e igual no
// servidor/cliente, sem o render duplo do antigo useEffect(setOrigin).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agendafacil-chi.vercel.app";

const firstName = (n: string) => (n || "").trim().split(" ")[0] || "";
const whenLabel = (d: number) => (d === 0 ? "hoje 🎉" : d === 1 ? "amanhã" : `em ${d} dias`);

export function BirthdayCard({
  clients,
  salonName,
  slug,
}: {
  clients: BirthdayClient[];
  salonName: string;
  slug: string;
}) {
  if (!clients.length) return null;

  const bookingLink = `${SITE_URL}/${slug}`;
  const waHref = (c: BirthdayClient) => {
    const digits = (c.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const full = digits.length <= 11 ? `55${digits}` : digits;
    const msg = `🎉 Feliz aniversário, ${firstName(c.name)}! Todo mundo aqui do ${salonName} te deseja um dia incrível. Vem comemorar com a gente — que tal agendar um horário especial? ${bookingLink}`;
    return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <Card className="p-4 min-w-0">
      <h2 className="font-display font-semibold flex items-center gap-2 text-sm">
        <Cake className="h-[18px] w-[18px] text-pink-500" /> Aniversários
      </h2>
      <div className="mt-3 space-y-2.5">
        {clients.map((c) => {
          const href = waHref(c);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  faz {c.turning_age} anos {whenLabel(c.days_until)}
                </p>
              </div>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 shrink-0 rounded-[var(--radius)] bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <ChatCircle className="h-3.5 w-3.5" /> Parabenizar
                </a>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">sem telefone</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
