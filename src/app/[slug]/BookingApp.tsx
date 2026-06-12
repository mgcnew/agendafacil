"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { Calendar } from "@/components/Calendar";
import { formatBRL, formatServicePrice, formatDuration, formatDateLong } from "@/lib/utils";
import { NICHES, type Niche } from "@/lib/themes";
import {
  Check,
  Clock,
  ChevronLeft,
  Loader2,
  CalendarDays,
  User,
  Sparkles,
  Phone,
  CircleCheck,
  History,
  MapPin,
} from "lucide-react";

type Salon = {
  id: string;
  name: string;
  slug: string;
  niche: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
};
type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  price_type: string | null;
  category_id: string | null;
};
type Category = { id: string; name: string; sort_order: number };
type Professional = { id: string; display_name: string; color: string | null; bio: string | null };
type Appt = {
  id: string;
  salon_name: string;
  member_name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total_price: number;
  services: string[];
};

type Step = "services" | "professional" | "time" | "auth" | "confirm" | "done";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

function toE164(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) return "+" + digits;
  return "+55" + digits;
}

// Data de hoje em YYYY-MM-DD usando componentes LOCAIS (não toISOString, que é
// UTC e à noite no Brasil pularia para o dia seguinte, bloqueando agendar hoje).
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BookingApp({ salon }: { salon: Salon }) {
  const supabase = useMemo(() => createClient(), []);
  const nicheMeta = NICHES[(salon.niche as Niche)] ?? NICHES.neutro;
  const [step, setStep] = useState<Step>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [proSvc, setProSvc] = useState<{ member_id: string; service_id: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pro, setPro] = useState<Professional | null>(null);
  const [date, setDate] = useState<string>(() => todayLocal());
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // service_id → desconto % ativo hoje (campanhas)
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  const [userId, setUserId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);
  const [mine, setMine] = useState<Appt[]>([]);

  // preço com desconto da campanha (ignora "sob consulta")
  const discPct = (s: Service) => (s.price_type === "on_request" ? 0 : discounts[s.id] ?? 0);
  const effPrice = (s: Service) => {
    const d = discPct(s);
    return d > 0 ? Math.round(Number(s.price) * (1 - d / 100) * 100) / 100 : Number(s.price);
  };

  const selectedServices = services.filter((s) => selected.includes(s.id));
  const totalPrice = selectedServices.reduce((a, s) => a + effPrice(s), 0);
  const totalDuration = selectedServices.reduce((a, s) => a + s.duration_min, 0);
  // preço total varia se algum serviço é "sob consulta" (a combinar) ou "a partir de"
  const hasOnRequest = selectedServices.some((s) => s.price_type === "on_request");
  const hasFrom = selectedServices.some((s) => s.price_type === "from");
  const totalPriceLabel = hasOnRequest
    ? "A combinar"
    : (hasFrom ? "A partir de " : "") + formatBRL(totalPrice);

  // profissionais que fazem TODOS os serviços escolhidos.
  // Fallback: serviço sem nenhum vínculo = qualquer profissional pode fazer.
  const eligiblePros = useMemo(() => {
    if (selected.length === 0) return pros;
    return pros.filter((p) =>
      selected.every((sid) => {
        const linked = proSvc.filter((x) => x.service_id === sid);
        return linked.length === 0 || linked.some((x) => x.member_id === p.id);
      }),
    );
  }, [pros, proSvc, selected]);

  // se o profissional escolhido deixou de ser elegível, limpa a seleção
  useEffect(() => {
    if (pro && !eligiblePros.some((p) => p.id === pro.id)) setPro(null);
  }, [eligiblePros, pro]);

  // carrega serviços e sessão
  useEffect(() => {
    supabase.rpc("public_services", { p_salon: salon.id }).then(({ data }) => {
      setServices((data as Service[]) ?? []);
      setLoadingServices(false);
    });
    supabase.rpc("public_service_categories" as never, { p_salon: salon.id } as never).then(({ data }) => {
      setCategories((data as unknown as Category[]) ?? []);
    });
    supabase.rpc("public_professionals", { p_salon: salon.id }).then(({ data }) => {
      setPros((data as Professional[]) ?? []);
    });
    supabase.rpc("public_professional_services", { p_salon: salon.id }).then(({ data }) => {
      setProSvc((data as { member_id: string; service_id: string }[]) ?? []);
    });
    supabase.rpc("public_campaign_discounts", { p_salon: salon.id }).then(({ data }) => {
      const map: Record<string, number> = {};
      for (const r of (data as { service_id: string; discount_percent: number }[]) ?? []) {
        map[r.service_id] = Number(r.discount_percent);
      }
      setDiscounts(map);
    });
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const metaName = (data.user.user_metadata?.full_name as string | undefined) ?? "";
      const { data: c } = await supabase
        .from("clients")
        .select("full_name, phone")
        .eq("salon_id", salon.id)
        .eq("profile_id", data.user.id)
        .maybeSingle();
      const nm = c?.full_name ?? metaName;
      const ph = c?.phone ?? data.user.phone ?? "";
      if (nm) { setName(nm); setClientName(nm); }
      if (ph) setPhone(ph);
    });
  }, [supabase, salon.id]);

  const loadSlots = useCallback(async () => {
    if (!pro || !totalDuration) return;
    setLoadingSlots(true);
    setSlot(null);
    const { data } = await supabase.rpc("get_availability", {
      p_salon: salon.id,
      p_member: pro.id,
      p_date: date,
      p_duration: totalDuration,
    });
    setSlots((data as string[]) ?? []);
    setLoadingSlots(false);
  }, [supabase, salon.id, pro, date, totalDuration]);

  useEffect(() => {
    if (step === "time") loadSlots();
  }, [step, date, loadSlots]);

  async function loadMine() {
    const { data } = await supabase.rpc("my_appointments", { p_salon: salon.id });
    setMine((data as Appt[]) ?? []);
    setShowMine(true);
  }

  function toggleService(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function sendOtp() {
    setAuthBusy(true);
    setAuthErr(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    if (error) {
      setAuthErr("Não foi possível enviar o código. Verifique o número.");
      setAuthBusy(false);
      return;
    }
    setOtpSent(true);
    setAuthBusy(false);
  }

  async function verifyOtp() {
    setAuthBusy(true);
    setAuthErr(null);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: toE164(phone),
      token: otp,
      type: "sms",
    });
    if (error || !data.user) {
      setAuthErr("Código inválido. Tente novamente.");
      setAuthBusy(false);
      return;
    }
    setUserId(data.user.id);
    setAuthBusy(false);
    setStep("confirm");
  }

  async function confirmBooking() {
    if (!pro || !slot) return;
    setBooking(true);
    setBookErr(null);
    const { error } = await supabase.rpc("book_appointment", {
      p_salon: salon.id,
      p_member: pro.id,
      p_service_ids: selected,
      p_starts_at: slot,
      p_client_name: name || "Cliente",
      p_client_phone: toE164(phone),
    });
    if (error) {
      setBookErr(
        error.message.includes("slot_taken")
          ? "Esse horário acabou de ser reservado. Escolha outro."
          : "Não foi possível concluir. Tente novamente.",
      );
      setBooking(false);
      return;
    }
    setBooking(false);
    setStep("done");
  }

  function goAfterTime() {
    if (userId) setStep("confirm");
    else setStep("auth");
  }

  /* ---------------- render ---------------- */
  return (
    <div className="max-w-xl mx-auto px-4 pb-24">
      {/* Cabeçalho do salão — limpo, sem gradiente */}
      <header className="pt-8 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {salon.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={salon.logo_url}
                alt={salon.name}
                className="h-14 w-14 rounded-2xl object-cover border border-border shrink-0"
              />
            ) : (
              <span className="grid place-items-center h-14 w-14 rounded-2xl bg-secondary text-secondary-foreground font-display text-2xl shrink-0">
                {salon.name.charAt(0)}
              </span>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{nicheMeta.tagline}</p>
              <h1 className="font-display text-2xl sm:text-3xl leading-tight">{salon.name}</h1>
              {salon.address && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {salon.address}
                </p>
              )}
            </div>
          </div>
          {userId && (
            <button
              onClick={loadMine}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-medium transition"
            >
              <History className="h-3.5 w-3.5" /> Meus
            </button>
          )}
        </div>

        {/* Saudação personalizada (cliente já conhecida) */}
        {step === "services" && userId && clientName && (
          <div className="mt-5 rounded-[var(--radius)] border border-border bg-card p-4 af-rise">
            <p className="font-display text-lg">
              Olá, {clientName.split(" ")[0]}! <span aria-hidden>👋</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Que bom te ver de novo — escolha os serviços e vamos agendar.
            </p>
          </div>
        )}
        {step === "services" && !userId && (
          <p className="mt-3 text-sm text-muted-foreground">
            Agende seu horário em poucos toques.
          </p>
        )}
      </header>

      {/* Stepper */}
      {step !== "done" && (
        <Stepper step={step} />
      )}

      {/* STEP: serviços */}
      {step === "services" && (
        <section className="space-y-3 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Escolha os serviços
          </h2>

          {/* Pills de categoria — só aparece se o salão tem categorias */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition ${
                  activeCategory === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card hover:border-foreground/25"
                }`}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition ${
                    activeCategory === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card hover:border-foreground/25"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {loadingServices ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Este salão ainda não cadastrou serviços.
            </Card>
          ) : null}
          {services.filter((s) => activeCategory === null || s.category_id === activeCategory).map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleService(s.id)}
                className={`w-full text-left rounded-[var(--radius)] border p-4 transition flex items-center gap-3 ${
                  on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <span className={`grid place-items-center h-6 w-6 rounded-full border shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                  {on && <Check className="h-4 w-4" />}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {formatDuration(s.duration_min)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {discPct(s) > 0 ? (
                    <>
                      <span className="block text-[11px] text-muted-foreground line-through">
                        {s.price_type === "from" ? "A partir de " : ""}{formatBRL(Number(s.price))}
                      </span>
                      <span className="font-semibold text-primary text-sm">
                        {s.price_type === "from" ? "A partir de " : ""}{formatBRL(effPrice(s))}
                      </span>
                      <span className="ml-1 inline-block rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 align-middle">
                        -{discPct(s)}%
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-primary text-sm">{formatServicePrice(Number(s.price), s.price_type)}</span>
                  )}
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* STEP: profissional */}
      {step === "professional" && (
        <section className="space-y-3 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Escolha o profissional
          </h2>
          {eligiblePros.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-[var(--radius)] border border-dashed border-border p-6 text-center">
              Nenhum profissional disponível para os serviços escolhidos. Tente ajustar a seleção.
            </p>
          )}
          {eligiblePros.map((p) => {
            const on = pro?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPro(p)}
                className={`w-full text-left rounded-[var(--radius)] border p-4 transition flex items-center gap-3 ${
                  on ? "border-primary ring-2 ring-primary/25" : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <span
                  className="grid place-items-center h-11 w-11 rounded-full text-white font-semibold shrink-0"
                  style={{ background: p.color || "var(--primary)" }}
                >
                  {p.display_name?.charAt(0) ?? "?"}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{p.display_name}</p>
                  {p.bio && <p className="text-xs text-muted-foreground">{p.bio}</p>}
                </div>
                {on && <Check className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
        </section>
      )}

      {/* STEP: horário */}
      {step === "time" && (
        <section className="space-y-4 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Escolha o horário
          </h2>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Calendar
              value={date}
              onChange={setDate}
              min={todayLocal()}
            />
          </div>
          <p className="text-sm text-muted-foreground capitalize">{formatDateLong(date + "T12:00:00")}</p>
          {loadingSlots ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Sem horários livres nesse dia. Tente outra data.
            </Card>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => {
                const t = new Date(s).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                });
                const on = slot === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`h-11 rounded-[var(--radius)] border text-sm font-medium transition ${
                      on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* STEP: autenticação por telefone */}
      {step === "auth" && (
        <section className="space-y-4 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> Identifique-se
          </h2>
          <Card className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cname">Seu nome</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como te chamamos?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Celular (WhatsApp)</Label>
              <Input
                id="cphone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                disabled={otpSent}
              />
            </div>
            {otpSent && (
              <div className="space-y-1.5">
                <Label htmlFor="otp">Código recebido por SMS</Label>
                <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" />
              </div>
            )}
            {authErr && <p className="text-sm text-red-600">{authErr}</p>}
            {!otpSent ? (
              <Button className="w-full" onClick={sendOtp} disabled={authBusy || !phone || !name}>
                {authBusy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar código
              </Button>
            ) : (
              <Button className="w-full" onClick={verifyOtp} disabled={authBusy || otp.length < 4}>
                {authBusy && <Loader2 className="h-4 w-4 animate-spin" />} Validar e continuar
              </Button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Usamos seu número só para confirmar o agendamento.
            </p>
            <button
              type="button"
              onClick={() => setStep("time")}
              className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
          </Card>
        </section>
      )}

      {/* STEP: confirmação */}
      {step === "confirm" && pro && slot && (
        <section className="space-y-4 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CircleCheck className="h-5 w-5 text-primary" /> Revise e confirme
          </h2>
          <Card className="p-6 space-y-4">
            <Row label="Profissional" value={pro.display_name} />
            <Row label="Data" value={<span className="capitalize">{formatDateLong(slot)}</span>} />
            <Row
              label="Horário"
              value={new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            />
            <div className="border-t border-border pt-4 space-y-2">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span>
                    {s.name}
                    {discPct(s) > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">-{discPct(s)}%</span>
                    )}
                  </span>
                  {discPct(s) > 0 ? (
                    <span>
                      <span className="text-muted-foreground line-through mr-1.5">{formatBRL(Number(s.price))}</span>
                      <span className="text-foreground">{formatBRL(effPrice(s))}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{formatServicePrice(Number(s.price), s.price_type)}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Total · {formatDuration(totalDuration)}
              </span>
              <span className="font-display text-xl font-bold text-primary">{totalPriceLabel}</span>
            </div>
          </Card>
          {bookErr && <p className="text-sm text-red-600">{bookErr}</p>}
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep("time")} disabled={booking}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button className="flex-1" size="lg" onClick={confirmBooking} disabled={booking}>
              {booking && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar agendamento
            </Button>
          </div>
        </section>
      )}

      {/* STEP: concluído */}
      {step === "done" && (
        <section className="af-rise text-center py-10">
          <div className="grid place-items-center h-20 w-20 rounded-full bg-primary text-primary-foreground mx-auto af-float">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold mt-6">Agendamento confirmado!</h2>
          <p className="text-muted-foreground mt-2">
            {pro?.display_name} te espera{" "}
            {slot && (
              <b className="capitalize">
                {formatDateLong(slot)} às{" "}
                {new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </b>
            )}
            .
          </p>
          <div className="flex flex-col gap-2 mt-8">
            <Button onClick={loadMine}>
              <History className="h-4 w-4" /> Ver meus agendamentos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelected([]);
                setPro(null);
                setSlot(null);
                setStep("services");
              }}
            >
              Agendar outro
            </Button>
          </div>
        </section>
      )}

      {/* Barra inferior de navegação */}
      {(step === "services" || step === "professional" || step === "time") && (
        <BottomBar
          step={step}
          priceLabel={totalPriceLabel}
          hasPrice={selectedServices.length > 0}
          totalDuration={totalDuration}
          canNext={
            (step === "services" && selected.length > 0) ||
            (step === "professional" && !!pro) ||
            (step === "time" && !!slot)
          }
          onBack={() => {
            if (step === "professional") setStep("services");
            else if (step === "time") setStep("professional");
          }}
          onNext={() => {
            if (step === "services") setStep("professional");
            else if (step === "professional") setStep("time");
            else if (step === "time") goAfterTime();
          }}
        />
      )}
      {step === "auth" && (
        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur p-4">
          <div className="max-w-xl mx-auto">
            <Button variant="ghost" onClick={() => setStep("time")}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Drawer: meus agendamentos */}
      {showMine && (
        <MineDrawer mine={mine} onClose={() => setShowMine(false)} />
      )}
    </div>
  );

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    );
  }

  function MineDrawer({ mine, onClose }: { mine: Appt[]; onClose: () => void }) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <Card className="relative w-full sm:max-w-md max-h-[80vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold">Meus agendamentos</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          </div>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Você ainda não tem agendamentos aqui.
            </p>
          ) : (
            <div className="space-y-3">
              {mine.map((a) => (
                <div key={a.id} className="rounded-[var(--radius)] border border-border p-4">
                  <div className="flex justify-between items-start">
                    <p className="font-medium capitalize">{formatDateLong(a.starts_at)}</p>
                    <span className="text-xs rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    {" · "}{a.member_name}
                  </p>
                  <p className="text-sm mt-1">{a.services.join(", ")}</p>
                  <p className="text-sm font-semibold text-primary mt-1">{formatBRL(Number(a.total_price))}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["services", "professional", "time", "confirm"];
  const labels = ["Serviços", "Profissional", "Horário", "Confirmar"];
  const idx = step === "auth" ? 2 : order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {labels.map((l, i) => (
        <div key={l} className="flex-1">
          <div
            className={`h-1.5 rounded-full transition ${i <= idx ? "bg-primary" : "bg-muted"}`}
          />
          <p className={`text-[11px] mt-1.5 ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{l}</p>
        </div>
      ))}
    </div>
  );
}

function BottomBar({
  step,
  priceLabel,
  hasPrice,
  totalDuration,
  canNext,
  onBack,
  onNext,
}: {
  step: Step;
  priceLabel: string;
  hasPrice: boolean;
  totalDuration: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur p-4">
      <div className="max-w-xl mx-auto flex items-center gap-3">
        {step !== "services" && (
          <Button variant="outline" size="md" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {hasPrice && (
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{formatDuration(totalDuration)}</p>
            <p className="font-semibold text-primary">{priceLabel}</p>
          </div>
        )}
        <Button className={hasPrice ? "" : "flex-1"} size="lg" onClick={onNext} disabled={!canNext}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
