"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDate } from "@/lib/utils";
import {
  ArrowCounterClockwise,
  WhatsappLogo,
  Warning,
  XCircle,
  ClockCounterClockwise,
  UserMinus,
  MagnifyingGlass,
  CircleNotch,
  Sparkle,
  SealPercent,
} from "@phosphor-icons/react/dist/ssr";

// Piso mínimo pra sugerir campanha de reativação — abaixo disso, o grupo é
// pequeno demais pra justificar uma campanha (chamar 1 a 1 já resolve).
const REACTIVATION_CAMPAIGN_MIN_INACTIVE = 5;

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
type CampaignPerformance = { campaign_id: string; bookings: number; revenue: number; discount_given: number };

const TABS: { id: Bucket; label: string; icon: React.ElementType }[] = [
  { id: "no_shows", label: "Faltaram", icon: XCircle },
  { id: "cancelled", label: "Cancelaram", icon: ClockCounterClockwise },
  { id: "inactive", label: "Inativos", icon: UserMinus },
];

const WINDOW_OPTIONS = [30, 60, 90, 180];
const INACTIVE_OPTIONS = [30, 45, 60, 90];

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

function waLink(phone: string | null, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  // 55 (país) + DDD (2) + 8/9 dígitos → mínimo 12
  if (digits.length < 12) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

type PriorityPick = { client: WinbackClient; bucket: Bucket; headline: string };

/**
 * Escolhe 1 cliente pra destacar no banner — regra direta, sem IA/LLM.
 * Prioridade: cliente fiel que sumiu > risco de falta recorrente > qualquer
 * um dos baldes (fallback, pra sempre ter algo útil quando existir dado).
 */
function pickPriority(data: WinbackData): PriorityPick | null {
  const inactiveByVisits = [...data.inactive].sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0));
  const loyalGone = inactiveByVisits[0];
  if (loyalGone && (loyalGone.visits ?? 0) >= 3) {
    return {
      client: loyalGone,
      bucket: "inactive",
      headline: `${firstName(loyalGone.name)} já veio ${loyalGone.visits}x aqui e sumiu${loyalGone.last_at ? ` desde ${formatDate(loyalGone.last_at)}` : ""}. Vale chamar primeiro.`,
    };
  }

  const riskyByFaults = [...data.no_shows].sort((a, b) => (b.total_no_shows ?? 0) - (a.total_no_shows ?? 0));
  const risky = riskyByFaults[0];
  if (risky && (risky.total_no_shows ?? 0) >= 2) {
    return {
      client: risky,
      bucket: "no_shows",
      headline: `${firstName(risky.name)} já faltou ${risky.total_no_shows} vezes. Uma confirmação por WhatsApp pode evitar a próxima.`,
    };
  }

  if (loyalGone) {
    return { client: loyalGone, bucket: "inactive", headline: `${firstName(loyalGone.name)} está sumido${loyalGone.last_at ? ` desde ${formatDate(loyalGone.last_at)}` : ""}. Bora chamar de volta?` };
  }
  if (risky) {
    return { client: risky, bucket: "no_shows", headline: `${firstName(risky.name)} faltou recentemente. Quer remarcar?` };
  }
  const cancelledFirst = data.cancelled[0];
  if (cancelledFirst) {
    return { client: cancelledFirst, bucket: "cancelled", headline: `${firstName(cancelledFirst.name)} cancelou e ainda não remarcou.` };
  }
  return null;
}

export function RecuperarManager({
  salonId, initialData, campaigns, performance, salonName, slug,
}: {
  salonId: string;
  initialData: WinbackData;
  campaigns: Campaign[];
  performance: Record<string, CampaignPerformance>;
  salonName: string;
  slug: string;
}) {
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<Bucket>("no_shows");
  const [couponId, setCouponId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [windowDays, setWindowDays] = useState(60);
  const [inactiveDays, setInactiveDays] = useState(45);
  const [data, setData] = useState<WinbackData>(initialData);
  const [loading, setLoading] = useState(false);

  // Re-busca quando o período muda (pula a 1ª render — initialData já usa 60/45).
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    let active = true;
    setLoading(true);
    supabase
      .rpc("marketing_winback" as never, {
        p_salon: salonId, p_window_days: windowDays, p_inactive_days: inactiveDays,
      } as never)
      .then(({ data: d }) => {
        if (!active) return;
        setData((d as unknown as WinbackData) ?? { no_shows: [], cancelled: [], inactive: [] });
        setLoading(false);
      });
    return () => { active = false; };
  }, [supabase, salonId, windowDays, inactiveDays]);

  const coupon = campaigns.find((c) => c.id === couponId) ?? null;
  const q = query.toLowerCase().trim();
  const list = data[tab].filter((c) => !q || c.name.toLowerCase().includes(q));

  function message(c: WinbackClient, bucket: Bucket = tab): string {
    const couponTxt = coupon
      ? ` Use o cupom *${coupon.name}* e ganhe ${coupon.discount_percent}% de desconto na sua próxima visita!`
      : "";
    const base =
      bucket === "no_shows"
        ? `Oi ${firstName(c.name)}! Sentimos sua falta no seu horário aqui no ${salonName}. Sem problema — quer remarcar?`
        : bucket === "cancelled"
        ? `Oi ${firstName(c.name)}! Vimos que seu horário no ${salonName} foi cancelado. Bora reagendar um novo?`
        : `Oi ${firstName(c.name)}! Faz um tempinho que você não aparece aqui no ${salonName} 😊 Que tal marcar um horário?`;
    const bookingUrl =
      typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";
    return base + couponTxt + (bookingUrl ? `\n\nAgende aqui: ${bookingUrl}` : "");
  }

  function openWhatsApp(c: WinbackClient, bucket: Bucket = tab) {
    const link = waLink(c.phone, message(c, bucket));
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  }

  const priorityPick = pickPriority(data);
  const suggestCampaign = data.inactive.length >= REACTIVATION_CAMPAIGN_MIN_INACTIVE;

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

      {/* De olho na recuperação — regras diretas, sem IA, sempre refletem o dado carregado */}
      {(priorityPick || suggestCampaign) && (
        <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkle className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold">De olho na recuperação</p>
          </div>

          {priorityPick && (
            <div className="rounded-[var(--radius)] border border-border bg-background p-3">
              <p className="text-sm">{priorityPick.headline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={waLink(priorityPick.client.phone, "") === null}
                  onClick={() => openWhatsApp(priorityPick.client, priorityPick.bucket)}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  <WhatsappLogo className="h-4 w-4" /> Chamar {firstName(priorityPick.client.name)}
                </Button>
                {waLink(priorityPick.client.phone, "") === null && (
                  <span className="text-xs text-muted-foreground">sem telefone cadastrado</span>
                )}
              </div>
            </div>
          )}

          {suggestCampaign && (
            <div className="rounded-[var(--radius)] border border-border bg-background p-3">
              <p className="flex items-center gap-1.5 text-sm">
                <UserMinus className="h-4 w-4 shrink-0 text-primary" />
                {data.inactive.length} clientes estão inativos há mais de {inactiveDays} dias. Uma campanha de reativação pode trazer parte deles de volta.
              </p>
              <Link
                href={`/painel/${slug}/campanhas?nova=1&nome=${encodeURIComponent("Volta pra cá")}&desconto=15`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <SealPercent className="h-3.5 w-3.5" /> Criar campanha de reativação
              </Link>
            </div>
          )}
        </div>
      )}

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

      {/* Resultado do cupom escolhido — fecha o loop "chamei com esse cupom, quanto voltou" */}
      {coupon && (
        <p className="text-xs text-muted-foreground -mt-3">
          {performance[coupon.id] && performance[coupon.id].bookings > 0 ? (
            <>
              Esse cupom já gerou <strong className="text-foreground">{performance[coupon.id].bookings}</strong> agendamento{performance[coupon.id].bookings === 1 ? "" : "s"} e{" "}
              <strong className="text-foreground">{formatBRL(performance[coupon.id].revenue)}</strong> em receita.
            </>
          ) : (
            "Esse cupom ainda não tem agendamento registrado."
          )}
        </p>
      )}

      {/* Busca + período */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome…"
            className="w-full h-10 pl-9 pr-4 rounded-[var(--radius)] border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          {tab === "inactive" ? "Inativo há mais de" : "Janela"}
          <select
            value={tab === "inactive" ? inactiveDays : windowDays}
            onChange={(e) =>
              tab === "inactive"
                ? setInactiveDays(Number(e.target.value))
                : setWindowDays(Number(e.target.value))
            }
            className="h-10 rounded-[var(--radius)] border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {(tab === "inactive" ? INACTIVE_OPTIONS : WINDOW_OPTIONS).map((d) => (
              <option key={d} value={d}>{d} dias</option>
            ))}
          </select>
        </label>
      </div>

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
      {loading ? (
        <div className="grid place-items-center py-16">
          <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <ArrowCounterClockwise className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">
            {q
              ? "Nenhum cliente encontrado com esse nome."
              : tab === "no_shows"
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
