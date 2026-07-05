"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import NextImage from "next/image";
import { Button, Card, Input, Label } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { Calendar } from "@/components/Calendar";
import { formatBRL, formatServicePrice, formatDuration, formatDateLong } from "@/lib/utils";
import {
  CalendarDots,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  Heart,
  Images,
  MapPin,
  Package,
  Phone,
  Sparkle,
  User,
  X,
} from "@phosphor-icons/react/dist/ssr";

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
type Professional = { id: string; display_name: string; color: string | null; bio: string | null; photo_url: string | null };
type Appt = {
  id: string;
  salon_name: string;
  member_id: string;
  member_name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total_price: number;
  services: string[];
};
type ResaleProduct = { id: string; name: string; sale_price: number; unit: string; linked: boolean };

type Step = "services" | "professional" | "time" | "auth" | "confirm" | "done";
type GalleryPhoto = { id: string; url: string };
type MineTab = "next" | "history";

const UPCOMING_STATUSES = new Set(["pending", "confirmed", "in_progress"]);

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
  const [anyPro, setAnyPro] = useState(false);
  const [slotProMap, setSlotProMap] = useState<Record<string, Professional>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  // service_id → desconto % ativo hoje (campanhas)
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  const [userId, setUserId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");

  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);
  const [mineTab, setMineTab] = useState<MineTab>("next");
  const [mine, setMine] = useState<Appt[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [favoriteProId, setFavoriteProId] = useState<string | null>(null);
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // preço com desconto da campanha (ignora "sob consulta")
  const discPct = (s: Service) => (s.price_type === "on_request" ? 0 : discounts[s.id] ?? 0);
  const effPrice = (s: Service) => {
    const d = discPct(s);
    return d > 0 ? Math.round(Number(s.price) * (1 - d / 100) * 100) / 100 : Number(s.price);
  };

  const selectedServices = services.filter((s) => selected.includes(s.id));
  const totalPrice = selectedServices.reduce((a, s) => a + effPrice(s), 0);
  const totalDuration = selectedServices.reduce((a, s) => a + s.duration_min, 0);
  const selectedProducts = resaleProducts.filter((p) => selectedProductIds.includes(p.id));
  const productsTotal = selectedProducts.reduce((a, p) => a + Number(p.sale_price), 0);

  // profissional mais frequentado no histórico (mesma lógica do painel do dono)
  const suggestedProId = useMemo(() => {
    const count: Record<string, number> = {};
    for (const a of mine) {
      if (a.status !== "completed") continue;
      count[a.member_id] = (count[a.member_id] ?? 0) + 1;
    }
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ?? null;
  }, [mine]);
  // preço total varia se algum serviço é "sob consulta" (a combinar) ou "a partir de"
  const hasOnRequest = selectedServices.some((s) => s.price_type === "on_request");
  const hasFrom = selectedServices.some((s) => s.price_type === "from");
  const totalPriceLabel = hasOnRequest
    ? "A combinar"
    : (hasFrom ? "A partir de " : "") + formatBRL(totalPrice);

  // profissionais que fazem TODOS os serviços escolhidos.
  // Excluí profissionais sem nenhum serviço atribuído (ex: dono sem serviços).
  // Fallback: serviço sem nenhum vínculo = qualquer profissional com serviços pode fazer.
  const eligiblePros = useMemo(() => {
    const prosWithServices = pros.filter((p) => proSvc.some((x) => x.member_id === p.id));
    if (selected.length === 0) return prosWithServices;
    return prosWithServices.filter((p) =>
      selected.every((sid) => {
        const linked = proSvc.filter((x) => x.service_id === sid);
        return linked.length === 0 || linked.some((x) => x.member_id === p.id);
      }),
    );
  }, [pros, proSvc, selected]);

  // favorito manual (ou sugestão automática pelo histórico) aparece primeiro
  const sortedEligiblePros = useMemo(() => {
    const favId = favoriteProId ?? suggestedProId;
    if (!favId) return eligiblePros;
    return [...eligiblePros].sort((a, b) => (a.id === favId ? -1 : b.id === favId ? 1 : 0));
  }, [eligiblePros, favoriteProId, suggestedProId]);

  // se o profissional escolhido deixou de ser elegível, limpa a seleção
  useEffect(() => {
    if (pro && !eligiblePros.some((p) => p.id === pro.id)) {
      setPro(null);
      setAnyPro(false);
    }
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
    supabase
      .from("salon_gallery")
      .select("id, url")
      .eq("salon_id", salon.id)
      .order("sort_order")
      .then(({ data }) => setGallery((data as GalleryPhoto[]) ?? []));
    supabase.auth.getUser().then(async ({ data }) => {
      // favorito é sempre local (mesmo cliente logado pode usar outro aparelho
      // sem o favorito — ok por ora, mesmo padrão de identificação por localStorage).
      try {
        const saved = localStorage.getItem(`af_client_${salon.slug}`);
        if (saved) {
          const parsed = JSON.parse(saved) as { name?: string; phone?: string; favoriteProId?: string };
          if (parsed.favoriteProId) setFavoriteProId(parsed.favoriteProId);
          if (!data.user) {
            if (parsed.name) { setName(parsed.name); setClientName(parsed.name); }
            if (parsed.phone) { setPhone(parsed.phone); setSavedPhone(parsed.phone); }
          }
        }
      } catch { /* ignore */ }
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
  }, [supabase, salon.id, salon.slug]);

  const loadSlots = useCallback(async () => {
    if (!totalDuration || (!pro && !anyPro)) return;
    setLoadingSlots(true);
    setSlot(null);
    if (anyPro) {
      const map: Record<string, Professional> = {};
      for (const p of eligiblePros) {
        const { data } = await supabase.rpc("get_availability", {
          p_salon: salon.id, p_member: p.id, p_date: date, p_duration: totalDuration,
        });
        for (const s of (data as string[]) ?? []) {
          if (!map[s]) map[s] = p;
        }
      }
      setSlotProMap(map);
      setSlots(Object.keys(map).sort());
    } else {
      const { data } = await supabase.rpc("get_availability", {
        p_salon: salon.id, p_member: pro!.id, p_date: date, p_duration: totalDuration,
      });
      setSlots((data as string[]) ?? []);
    }
    setLoadingSlots(false);
  }, [supabase, salon.id, pro, date, totalDuration, anyPro, eligiblePros]);

  useEffect(() => {
    if (step === "time") loadSlots();
  }, [step, date, loadSlots]);

  // sugestões de produto (revenda) para os serviços escolhidos
  useEffect(() => {
    if (selected.length === 0) {
      setResaleProducts([]);
      return;
    }
    supabase
      .rpc("public_resale_products" as never, { p_salon: salon.id, p_service_ids: selected } as never)
      .then(({ data }) => setResaleProducts((data as unknown as ResaleProduct[]) ?? []));
  }, [supabase, salon.id, selected]);

  const fetchMine = useCallback(async () => {
    // O telefone é gravado em E164 no book_appointment; normalizar aqui também,
    // senão a busca exata (c.phone = p_phone) não casa e a lista vem vazia.
    const ph = userId ? null : toE164(savedPhone || phone);
    if (!userId && !ph) return;
    const { data } = await supabase.rpc("public_my_appointments" as never, {
      p_salon: salon.id,
      p_phone: ph,
    } as never);
    setMine((data as unknown as Appt[]) ?? []);
  }, [supabase, salon.id, userId, savedPhone, phone]);

  // carrega o histórico em segundo plano assim que o cliente é conhecido —
  // alimenta a sugestão de profissional favorito sem precisar abrir "Meus".
  useEffect(() => {
    if (userId || savedPhone) fetchMine();
  }, [userId, savedPhone, fetchMine]);

  async function loadMine() {
    await fetchMine();
    setMineTab("next");
    setShowMine(true);
  }

  function toggleFavoritePro(id: string) {
    const next = favoriteProId === id ? null : id;
    setFavoriteProId(next);
    try {
      const saved = localStorage.getItem(`af_client_${salon.slug}`);
      const parsed = saved ? JSON.parse(saved) : {};
      localStorage.setItem(`af_client_${salon.slug}`, JSON.stringify({ ...parsed, favoriteProId: next }));
    } catch { /* ignore */ }
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function cancelAppt(a: Appt) {
    if (!window.confirm("Cancelar este agendamento? O horário será liberado para outros clientes.")) return;
    setCancelingId(a.id);
    setCancelErr(null);
    const { error } = await supabase.rpc("public_cancel_appointment" as never, {
      p_appointment: a.id,
      p_phone: userId ? null : toE164(savedPhone || phone),
    } as never);
    setCancelingId(null);
    if (error) {
      setCancelErr("Não foi possível cancelar. Atualize e tente novamente.");
      return;
    }
    await loadMine();
  }

  function toggleService(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function confirmBooking() {
    if (!pro || !slot) return;
    setBooking(true);
    setBookErr(null);
    // produtos escolhidos não têm cobrança online — viram nota pra equipe
    // preparar/oferecer no balcão (visível na agenda/comanda).
    const productsNote =
      selectedProducts.length > 0
        ? `Produtos desejados: ${selectedProducts.map((p) => p.name).join(", ")}`
        : undefined;
    const { error } = await supabase.rpc("book_appointment", {
      p_salon: salon.id,
      p_member: pro.id,
      p_service_ids: selected,
      p_starts_at: slot,
      p_client_name: name || "Cliente",
      p_client_phone: toE164(phone),
      ...(productsNote ? { p_notes: productsNote } : {}),
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
    if (userId || savedPhone) setStep("confirm");
    else setStep("auth");
  }

  /* ---------------- render ---------------- */
  return (
    <div className="max-w-xl mx-auto px-4 pb-40">
      {/* Cabeçalho — leve, identidade completa do salão só aparece na confirmação */}
      <header className="pt-6 pb-2">
        <div className="flex items-center justify-end gap-1">
          {gallery.length > 0 && (
            <button
              onClick={() => setShowGallery(true)}
              aria-label="Ver galeria de fotos"
              className="grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <Images className="h-4.5 w-4.5" />
            </button>
          )}
          {(userId || savedPhone) && (
            <button
              onClick={loadMine}
              aria-label="Meus agendamentos"
              className="grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <ClockCounterClockwise className="h-4.5 w-4.5" />
            </button>
          )}
        </div>

        {/* Saudação — a única coisa que permanece sempre visível no topo */}
        {step === "services" && (userId || savedPhone) && clientName && (
          <div className="mt-2 af-rise">
            <p className="font-display text-2xl">
              Olá, {clientName.split(" ")[0]}! <span aria-hidden>👋</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Que bom te ver de novo — escolha os serviços e vamos agendar.
            </p>
          </div>
        )}
        {step === "services" && !userId && !savedPhone && (
          <div className="mt-2 af-rise">
            <p className="font-display text-2xl">Seja bem-vindo(a)!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Agende seu horário em poucos toques.
            </p>
          </div>
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
            <Sparkle className="h-5 w-5 text-primary" /> Escolha os serviços
          </h2>

          {/* Pills de categoria — sticky com fade nas bordas */}
          {categories.length > 0 && (
            <div className="sticky top-0 z-10 -mx-4 bg-background/95 backdrop-blur-sm">
              <div className="relative">
                <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition ${
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
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition ${
                        activeCategory === c.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border bg-card hover:border-foreground/25"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {/* fade direita — indica mais conteúdo */}
                <div className="pointer-events-none absolute right-0 inset-y-0 w-10 bg-gradient-to-l from-background/95 to-transparent" />
              </div>
            </div>
          )}

          {loadingServices ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <CircleNotch className="h-6 w-6 animate-spin" />
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

          {/* Sugestão de produto (revenda do estoque) para os serviços escolhidos */}
          {selected.length > 0 && resaleProducts.length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" /> Que tal levar também?
              </h3>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4">
                {resaleProducts.map((p) => {
                  const on = selectedProductIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className={`shrink-0 w-36 text-left rounded-[var(--radius)] border p-3 transition ${
                        on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                      }`}
                    >
                      <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold text-primary">{formatBRL(Number(p.sale_price))}</span>
                        <span className={`grid place-items-center h-5 w-5 rounded-full border shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Pagamento no balcão, junto do serviço.</p>
            </div>
          )}
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
          {/* Opção "sem preferência" — agrega horários de todos */}
          {eligiblePros.length > 1 && (
            <button
              onClick={() => { setAnyPro(true); setPro(null); setTimeout(() => setStep("time"), 280); }}
              className={`w-full text-left rounded-[var(--radius)] border p-4 transition flex items-center gap-3 ${
                anyPro ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
              }`}
            >
              <span className="grid place-items-center h-11 w-11 rounded-full bg-secondary text-secondary-foreground font-semibold shrink-0 text-lg">
                ✦
              </span>
              <div className="flex-1">
                <p className="font-medium">Sem preferência</p>
                <p className="text-xs text-muted-foreground">Ver todos os horários disponíveis</p>
              </div>
              {anyPro && <Check className="h-5 w-5 text-primary" />}
            </button>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sortedEligiblePros.map((p) => {
              const on = !anyPro && pro?.id === p.id;
              const isFavorite = favoriteProId === p.id;
              const isSuggested = !favoriteProId && suggestedProId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { setAnyPro(false); setPro(p); setTimeout(() => setStep("time"), 280); }}
                  className={`relative rounded-[var(--radius)] border p-4 transition flex flex-col items-center text-center gap-2 ${
                    on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                  }`}
                >
                  {on && <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); toggleFavoritePro(p.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleFavoritePro(p.id); } }}
                    aria-label={isFavorite ? "Remover profissional favorito" : "Marcar como favorito"}
                    className="absolute top-2 left-2 grid place-items-center h-6 w-6 rounded-full text-muted-foreground hover:text-red-500 transition"
                  >
                    <Heart className="h-4 w-4" weight={isFavorite ? "fill" : "regular"} style={isFavorite ? { color: "#ef4444" } : undefined} />
                  </span>
                  <BookingAvatar p={p} size={72} />
                  <div className="min-w-0 w-full">
                    <p className="font-medium text-sm leading-tight truncate">{p.display_name}</p>
                    {p.bio && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{p.bio}</p>}
                    {(isFavorite || isSuggested) && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                        {isFavorite ? "Seu favorito" : "Você costuma escolher"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP: horário */}
      {step === "time" && (
        <section className="space-y-4 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CalendarDots className="h-5 w-5 text-primary" /> Escolha o horário
          </h2>
          <div className="space-y-2">
            <DateRuler value={date} onChange={setDate} />
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="text-primary text-sm font-medium hover:underline"
            >
              Ver mais datas →
            </button>
          </div>
          <p className="text-sm text-muted-foreground capitalize">{formatDateLong(date + "T12:00:00")}</p>
          {loadingSlots ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <CircleNotch className="h-6 w-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <p>Sem horários livres nesse dia.</p>
              <button
                className="mt-2 text-primary text-sm font-medium hover:underline"
                onClick={() => {
                  const next = new Date(date + "T12:00:00");
                  next.setDate(next.getDate() + 1);
                  setDate(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-${String(next.getDate()).padStart(2,"0")}`);
                }}
              >
                Ver próximo dia →
              </button>
            </Card>
          ) : (
            <SlotGrid
              slots={slots}
              selected={slot}
              onSelect={(s) => {
                setSlot(s);
                if (anyPro) setPro(slotProMap[s]);
                setTimeout(() => goAfterTime(), 300);
              }}
            />
          )}
        </section>
      )}

      {/* STEP: identificação (sem verificação OTP) */}
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
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                try {
                  localStorage.setItem(
                    `af_client_${salon.slug}`,
                    JSON.stringify({ name, phone, favoriteProId }),
                  );
                } catch { /* ignore */ }
                setSavedPhone(phone);
                setStep("confirm");
              }}
              disabled={!name || !phone}
            >
              Continuar
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Usamos seu número só para confirmar o agendamento.
            </p>
            <button
              type="button"
              onClick={() => setStep("time")}
              className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition"
            >
              <CaretLeft className="h-4 w-4" /> Voltar
            </button>
          </Card>
        </section>
      )}

      {/* STEP: confirmação */}
      {step === "confirm" && pro && slot && (
        <section className="space-y-4 af-rise">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" /> Revise e confirme
          </h2>
          <Card className="p-6 space-y-4">
            {/* Identidade do salão — só aparece aqui, na revisão final */}
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              {salon.logo_url ? (
                <NextImage
                  src={salon.logo_url}
                  alt={salon.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-xl object-cover border border-border shrink-0"
                />
              ) : (
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-secondary text-secondary-foreground font-display text-lg shrink-0">
                  {salon.name.charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Você está agendando em</p>
                <p className="font-display text-lg leading-tight truncate">{salon.name}</p>
                {salon.address && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {salon.address}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pb-1">
              <BookingAvatar p={pro} size={48} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Profissional</p>
                <p className="font-medium truncate">{pro.display_name}</p>
              </div>
            </div>
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
              {selectedProducts.map((p) => (
                <div key={p.id} className="flex justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" /> {p.name}
                  </span>
                  <span>{formatBRL(Number(p.sale_price))}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Total · {formatDuration(totalDuration)}
              </span>
              <span className="font-display text-xl font-bold text-primary">{totalPriceLabel}</span>
            </div>
            {selectedProducts.length > 0 && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                + {formatBRL(productsTotal)} em produtos, pagos no balcão junto do serviço.
              </p>
            )}
          </Card>
          {bookErr && <p className="text-sm text-red-600">{bookErr}</p>}
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep("time")} disabled={booking}>
              <CaretLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button className="flex-1" size="lg" onClick={confirmBooking} disabled={booking}>
              {booking && <CircleNotch className="h-4 w-4 animate-spin" />} Confirmar agendamento
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
          <p className="font-display text-lg mt-2">
            {salon.name} agradece o seu agendamento! <span aria-hidden>💈</span>
          </p>
          <p className="text-muted-foreground mt-1">
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
              <ClockCounterClockwise className="h-4 w-4" /> Ver meus agendamentos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelected([]);
                setSelectedProductIds([]);
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
          services={selectedServices}
          priceLabel={totalPriceLabel}
          hasPrice={selectedServices.length > 0}
          totalDuration={totalDuration}
          productsCount={step === "services" ? selectedProducts.length : 0}
          canNext={
            (step === "services" && selected.length > 0) ||
            (step === "professional" && (!!pro || anyPro)) ||
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
              <CaretLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Drawer: meus agendamentos */}
      <AnimatePresence>
        {showMine && (
          <MineDrawer
            key="mine"
            mine={mine}
            tab={mineTab}
            onTabChange={setMineTab}
            onClose={() => { setShowMine(false); setCancelErr(null); }}
          />
        )}
      </AnimatePresence>

      {/* Modal: galeria de fotos */}
      {showGallery && gallery.length > 0 && (
        <GalleryModal photos={gallery} onClose={() => setShowGallery(false)} />
      )}

      {/* Modal: escolher outra data (além dos próximos 7 dias) */}
      {showDatePicker && (
        <MotionModal onClose={() => setShowDatePicker(false)}>
          <Card className="w-full sm:max-w-md mx-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">Escolher outra data</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowDatePicker(false)}>Fechar</Button>
            </div>
            <Calendar
              value={date}
              onChange={(d) => { setDate(d); setShowDatePicker(false); }}
              min={todayLocal()}
            />
          </Card>
        </MotionModal>
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

  function BookingAvatar({ p, size = 72 }: { p: Professional; size?: number }) {
    if (p.photo_url) {
      return (
        <NextImage src={p.photo_url} alt={p.display_name} width={size} height={size}
          className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
      );
    }
    return (
      <span className="grid place-items-center rounded-full text-white font-semibold shrink-0"
        style={{ width: size, height: size, background: p.color || "var(--primary)", fontSize: Math.round(size * 0.4) }}>
        {p.display_name?.charAt(0) ?? "?"}
      </span>
    );
  }

  function MineDrawer({
    mine,
    tab,
    onTabChange,
    onClose,
  }: {
    mine: Appt[];
    tab: MineTab;
    onTabChange: (t: MineTab) => void;
    onClose: () => void;
  }) {
    const isUpcoming = (a: Appt) =>
      UPCOMING_STATUSES.has(a.status) && new Date(a.starts_at).getTime() > Date.now();
    const filtered = mine.filter((a) => (tab === "next" ? isUpcoming(a) : !isUpcoming(a)));
    return (
      <MotionModal onClose={onClose}>
        <Card className="w-full sm:max-w-md mx-auto max-h-[80vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold">Meus agendamentos</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          </div>
          <div className="flex gap-1.5 mb-4 rounded-full bg-muted p-1">
            {(["next", "history"] as MineTab[]).map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition ${
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t === "next" ? "Próximos" : "Histórico"}
              </button>
            ))}
          </div>
          {cancelErr && (
            <div className="mb-3 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
              {cancelErr}
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {tab === "next" ? "Nenhum agendamento futuro por aqui." : "Ainda não há histórico por aqui."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => {
                const cancellable =
                  (a.status === "pending" || a.status === "confirmed") &&
                  new Date(a.starts_at).getTime() > Date.now();
                return (
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
                    {cancellable && (
                      <button
                        onClick={() => cancelAppt(a)}
                        disabled={cancelingId === a.id}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                        {cancelingId === a.id ? "Cancelando…" : "Cancelar agendamento"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </MotionModal>
    );
  }
}

function GalleryModal({
  photos,
  onClose,
}: {
  photos: GalleryPhoto[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);

  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* topo */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/60 text-sm font-medium">
          {idx + 1} / {photos.length}
        </span>
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* imagem */}
      <div className="flex-1 flex items-center justify-center relative px-12 min-h-0">
        {photos.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <CaretLeft className="h-6 w-6" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photos[idx].id}
          src={photos[idx].url}
          alt={`Foto ${idx + 1}`}
          className="max-h-full max-w-full object-contain rounded-lg select-none"
          style={{ animation: "fadeIn 0.2s ease" }}
        />
        {photos.length > 1 && (
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <CaretRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* miniaturas */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3 shrink-0 justify-center">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIdx(i)}
              className={`relative shrink-0 h-14 w-20 rounded-md overflow-hidden border-2 transition ${
                i === idx ? "border-primary opacity-100" : "border-transparent opacity-50 hover:opacity-75"
              }`}
            >
              <NextImage src={p.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  services,
  priceLabel,
  hasPrice,
  totalDuration,
  productsCount,
  canNext,
  onBack,
  onNext,
}: {
  step: Step;
  services: { name: string }[];
  priceLabel: string;
  hasPrice: boolean;
  totalDuration: number;
  productsCount: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const serviceLabel = services.map((s) => s.name).join(" + ");
  return (
    <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur safe-bottom">
      {hasPrice && (
        <div className="border-b border-border/50 px-4 py-2 max-w-xl mx-auto flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate flex-1">
            {serviceLabel}
            {productsCount > 0 && ` · +${productsCount} produto${productsCount > 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{formatDuration(totalDuration)}</span>
            <span className="font-semibold text-primary text-sm">{priceLabel}</span>
          </div>
        </div>
      )}
      <div className="p-4 max-w-xl mx-auto flex items-center gap-3">
        {step !== "services" && (
          <Button variant="outline" size="md" onClick={onBack}>
            <CaretLeft className="h-4 w-4" />
          </Button>
        )}
        <Button className="flex-1" size="lg" onClick={onNext} disabled={!canNext}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function DateRuler({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dow = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return { ds, dow, day: d.getDate() };
    });
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
      {days.map((d, i) => {
        const on = d.ds === value;
        return (
          <button
            key={d.ds}
            type="button"
            onClick={() => onChange(d.ds)}
            className={`shrink-0 w-14 rounded-[var(--radius)] border py-2.5 flex flex-col items-center transition ${
              on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:border-foreground/25"
            }`}
          >
            <span className="text-[11px] uppercase tracking-wide opacity-80">{i === 0 ? "Hoje" : d.dow}</span>
            <span className="text-lg font-semibold leading-none mt-1">{d.day}</span>
          </button>
        );
      })}
    </div>
  );
}

function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (s: string) => void;
}) {
  const slotHour = (s: string) =>
    parseInt(new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", timeZone: "America/Sao_Paulo" }));

  const groups = [
    { label: "Manhã", icon: "🌤", slots: slots.filter((s) => slotHour(s) < 12) },
    { label: "Tarde", icon: "☀️", slots: slots.filter((s) => slotHour(s) >= 12 && slotHour(s) < 18) },
    { label: "Noite", icon: "🌙", slots: slots.filter((s) => slotHour(s) >= 18) },
  ].filter((g) => g.slots.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {g.icon} {g.label}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {g.slots.map((s) => {
              const t = new Date(s).toLocaleTimeString("pt-BR", {
                hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
              });
              const on = selected === s;
              return (
                <button
                  key={s}
                  onClick={() => onSelect(s)}
                  className={`h-11 rounded-[var(--radius)] border text-sm font-medium transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary scale-[0.97]"
                      : "border-border bg-card hover:border-primary"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
