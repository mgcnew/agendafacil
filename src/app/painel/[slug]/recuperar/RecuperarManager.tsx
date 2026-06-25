"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  ArrowCounterClockwise,
  WhatsappLogo,
  Warning,
  XCircle,
  ClockCounterClockwise,
  UserMinus,
} from "@phosphor-icons/react/dist/ssr";

type WinbackClient = {
  client_id: string;
  name: string;
  phone: string | null;
  last_at: string | null;
  recent?: number;
  total_no_shows?: number;
  visits?: number;
};
type Bucket = "no_shows" | "cancelled" | "inactive";
type WinbackData = Record<Bucket, WinbackClient[]>;
type Campaign = { id: string; name: string; discount_percent: number };

const TABS: { id: Bucket; label: string; icon: React.ElementType }[] = [
  { id: "no_shows", label: "Faltaram", icon: XCircle },
  { id: "cancelled", label: "Cancelaram", icon: ClockCounterClockwise },
  { id: "inactive", label: "Inativos", icon: UserMinus },
];

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

function waLink(phone: string | null, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  // 55 (país) + DDD (2) + 8/9 dígitos → mínimo 12
  if (digits.length < 12) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function RecuperarManager({
  data, campaigns, salonName, slug,
}: {
  data: WinbackData;
  campaigns: Campaign[];
  salonName: string;
  slug: string;
}) {
  const [tab, setTab] = useState<Bucket>("no_shows");
  const [couponId, setCouponId] = useState<string>("");
  const coupon = campaigns.find((c) => c.id === couponId) ?? null;
  const list = data[tab];

  function message(c: WinbackClient): string {
    const couponTxt = coupon
      ? ` Use o cupom *${coupon.name}* e ganhe ${coupon.discount_percent}% de desconto na sua próxima visita!`
      : "";
    const base =
      tab === "no_shows"
        ? `Oi ${firstName(c.name)}! Sentimos sua falta no seu horário aqui no ${salonName}. Sem problema — quer remarcar?`
        : tab === "cancelled"
        ? `Oi ${firstName(c.name)}! Vimos que seu horário no ${salonName} foi cancelado. Bora reagendar um novo?`
        : `Oi ${firstName(c.name)}! Faz um tempinho que você não aparece aqui no ${salonName} 😊 Que tal marcar um horário?`;
    const bookingUrl =
      typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";
    return base + couponTxt + (bookingUrl ? `\n\nAgende aqui: ${bookingUrl}` : "");
  }

  function openWhatsApp(c: WinbackClient) {
    const link = waLink(c.phone, message(c));
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6 af-rise">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <ArrowCounterClockwise className="h-6 w-6 text-primary" /> Recuperar clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Traga de volta quem faltou, cancelou ou está sumido — com uma mensagem pronta no WhatsApp.
        </p>
      </header>

      {/* Cupom de retorno (opcional) */}
      {campaigns.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Anexar cupom:</span>
          <button
            onClick={() => setCouponId("")}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              couponId === "" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            Sem cupom
          </button>
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => setCouponId(c.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                couponId === c.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
              }`}
            >
              {c.name} · {c.discount_percent}%
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const count = data[t.id].length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {count > 0 && (
                <span className="ml-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {list.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <ArrowCounterClockwise className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">
            {tab === "no_shows"
              ? "Ninguém faltou no período. 🎉"
              : tab === "cancelled"
              ? "Nenhum cancelamento em aberto para recuperar."
              : "Nenhum cliente inativo no período."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => {
            const hasPhone = waLink(c.phone, "") !== null;
            const risky = (c.total_no_shows ?? 0) >= 2;
            return (
              <div
                key={c.client_id}
                className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{c.name}</p>
                    {risky && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full bg-red-500/12 text-red-600 px-2 py-0.5">
                        <Warning className="h-3 w-3" /> {c.total_no_shows} faltas
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tab === "inactive"
                      ? `Última visita ${c.last_at ? formatDate(c.last_at) : "—"}${c.visits ? ` · ${c.visits} visita${c.visits > 1 ? "s" : ""}` : ""}`
                      : `${tab === "no_shows" ? "Faltou" : "Cancelou"} em ${c.last_at ? formatDate(c.last_at) : "—"}`}
                    {!hasPhone && " · sem telefone"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasPhone}
                  onClick={() => openWhatsApp(c)}
                  className="shrink-0 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  <WhatsappLogo className="h-4 w-4" /> Chamar
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
