"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NextImage from "next/image";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { AnimatePresence } from "framer-motion";
import { MotionModal } from "@/components/MotionModal";
import { SocialLinksRow } from "@/components/SocialLinksRow";
import { HomeAddressForm, ENDERECO_VAZIO, enderecoCompleto, type Endereco } from "./HomeAddressForm";
import { homeServiceFee, regraTarifa } from "@/lib/homeService";
import { maskBrPhone, toStoredPhone } from "@/lib/whatsapp/phone";
import { Calendar } from "@/components/Calendar";
import { TimeSlots } from "@/components/TimeSlots";
import { formatBRL, formatServicePrice, formatDuration, formatDateLong } from "@/lib/utils";
import type { Json } from "@/lib/database.types";
import {
  EMPTY_ANAMNESIS,
  computeAlertSummary,
  getAnamnesisConfig,
  type AnamnesisForm,
  type ConditionKey,
  type Niche,
} from "@/lib/anamnesis";
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
  Heartbeat,
  House,
  Images,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Sparkle,
  Storefront,
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
  instagram?: string | null;
  facebook?: string | null;
  google_business?: string | null;
  city?: string | null;
  home_service_enabled?: boolean | null;
  home_first_km_fee?: number | null;
  home_extra_km_fee?: number | null;
  home_max_km?: number | null;
  home_terms?: string | null;
};
type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  price_type: string | null;
  category_id: string | null;
  bring_own_tools?: boolean | null;
  allows_home_service?: boolean | null;
};
/** Retorno de `public_home_address` — endereço e km já conhecidos da cliente. */
type HomeAddressRow = {
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  distance_km: number | null;
  fee: number | null;
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

type Step = "services" | "professional" | "time" | "auth" | "confirm" | "done" | "waitlist_done";

/**
 * Cada etapa vira um `?passo=` na URL, com entrada própria no histórico: o
 * "voltar" do celular volta uma etapa em vez de sair da página (quem chega
 * pelo WhatsApp caía de volta na conversa e perdia tudo). Serviços é a URL
 * limpa; as telas finais não ganham passo — voltar delas recomeça.
 */
const STEP_ORDER: Step[] = ["services", "professional", "time", "auth", "confirm"];
const STEP_SLUG: Partial<Record<Step, string>> = {
  professional: "profissional",
  time: "horario",
  auth: "dados",
  confirm: "confirmar",
};
const SLUG_STEP: Record<string, Step> = Object.fromEntries(
  Object.entries(STEP_SLUG).map(([k, v]) => [v, k as Step]),
);

/** Rascunho do pedido, por salão, na sessão do navegador (some ao fechar a aba). */
type Draft = { selected: string[]; proId: string | null; anyPro: boolean; date: string; modo: "salon" | "home" };
const draftKey = (slug: string) => `zl_booking_${slug}`;
type GalleryPhoto = { id: string; url: string; caption: string | null };
type MineTab = "next" | "history" | "waitlist";
type WaitlistEntry = {
  id: string;
  preferred_date: string;
  status: string;
  member_name: string | null;
  services: string[];
};
type AnamnesisFlow = "invite" | "conditions" | "details" | "thanks" | null;

const UPCOMING_STATUSES = new Set(["pending", "confirmed", "in_progress"]);
// se o cliente disser "mais tarde", só voltamos a convidar depois de um tempo
const ANAMNESIS_COOLDOWN_DAYS = 14;

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

/**
 * Telefone no formato de gravação, ou null.
 *
 * A versão antiga montava `"+55" + digits` sem conferir nada: campo vazio
 * virava "+55", "abc" virava "+55", número pela metade virava telefone com
 * cara de válido. Cadastro assim NUNCA recebe mensagem — e ninguém percebe,
 * porque a fila descarta antes de a mensagem existir.
 */
/**
 * Chave deste aparelho para "Meus agendamentos", cancelar, endereço salvo e
 * ficha. O banco não aceita mais o telefone como prova: celular não é segredo,
 * e com ele qualquer um via e cancelava os horários de outra pessoa. Cada
 * agendamento feito aqui é ligado a esta chave logo depois de criado
 * (public_claim_appointment); em outro aparelho, ele não aparece.
 */
function deviceToken(slug: string, criar: boolean): string | null {
  const k = `zl_device_${slug}`;
  try {
    let t = localStorage.getItem(k);
    if (!t && criar) {
      t = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(k, t);
    }
    return t;
  } catch {
    return null;
  }
}

function toE164(raw: string): string {
  return toStoredPhone(raw) ?? "";
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
  const searchParams = useSearchParams();
  const passo = searchParams.get("passo");
  const [prosLoaded, setProsLoaded] = useState(false);
  // Só depois de restaurar o rascunho a URL passa a mandar na etapa — antes
  // disso um ?passo=horario de uma recarga seria recusado por falta de serviço.
  const [restored, setRestored] = useState(false);
  // Quantas etapas nossas existem atrás desta no histórico. O "Voltar" da
  // tela usa o histórico enquanto houver, para o botão do celular e o da
  // tela andarem juntos.
  const depthRef = useRef(0);
  // A próxima troca de etapa substitui a entrada atual em vez de empilhar
  // (recomeçar depois de agendar não deve deixar o pedido velho no voltar).
  const replaceNextRef = useRef(false);
  const [services, setServices] = useState<Service[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [proSvc, setProSvc] = useState<{ member_id: string; service_id: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pro, setPro] = useState<Professional | null>(null);
  const [date, setDate] = useState<string>(() => todayLocal());
  const dateRef = useRef(date);
  dateRef.current = date;
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
  // Falha ao carregar não pode virar "nenhum agendamento": a pessoa achava
  // que o horário tinha sumido.
  const [mineErr, setMineErr] = useState(false);
  // Se este aparelho já tem chave. Lido depois de montar (localStorage não
  // existe no servidor): ler no render fazia o ícone do cabeçalho divergir do
  // HTML do servidor e o React redesenhar a página inteira.
  const [temChave, setTemChave] = useState(false);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [authIntent, setAuthIntent] = useState<"book" | "waitlist">("book");
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistErr, setWaitlistErr] = useState<string | null>(null);
  const [cancelingWaitlistId, setCancelingWaitlistId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [inspirationIds, setInspirationIds] = useState<string[]>([]);
  const [favoriteProId, setFavoriteProId] = useState<string | null>(null);
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Atendimento em domicílio ──────────────────────────────────────────
  const [modo, setModo] = useState<"salon" | "home">("salon");
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO);
  // km medido pela profissional numa visita anterior. Existindo, o valor sai
  // fechado já aqui; faltando, a cliente vê a regra e recebe o valor depois.
  const [kmConhecido, setKmConhecido] = useState<number | null>(null);

  const [bookedClientId, setBookedClientId] = useState<string | null>(null);
  const [anamnesisFlow, setAnamnesisFlow] = useState<AnamnesisFlow>(null);
  const [anaForm, setAnaForm] = useState<AnamnesisForm>(EMPTY_ANAMNESIS);
  const [savingAnamnesis, setSavingAnamnesis] = useState(false);
  const [anaErr, setAnaErr] = useState<string | null>(null);

  // preço com desconto da campanha (ignora "sob consulta")
  const discPct = (s: Service) => (s.price_type === "on_request" ? 0 : discounts[s.id] ?? 0);
  const effPrice = (s: Service) => {
    const d = discPct(s);
    return d > 0 ? Math.round(Number(s.price) * (1 - d / 100) * 100) / 100 : Number(s.price);
  };

  const tarifa = {
    firstKmFee: Number(salon.home_first_km_fee ?? 0),
    extraKmFee: Number(salon.home_extra_km_fee ?? 0),
  };
  // A escolha só aparece se o salão liga E existe pelo menos um serviço que
  // sai do salão. Sem as duas coisas, a pergunta não tem resposta possível.
  const servicosEmCasa = services.filter((s) => s.allows_home_service);
  const podeDomicilio = !!salon.home_service_enabled && servicosEmCasa.length > 0;
  const emCasa = podeDomicilio && modo === "home";
  // Escolhendo domicílio, a lista só mostra o que de fato pode ser feito fora
  // do salão — em vez de deixar escolher e recusar depois.
  const servicosVisiveis = emCasa ? servicosEmCasa : services;

  const selectedServices = services.filter((s) => selected.includes(s.id));
  const totalPrice = selectedServices.reduce((a, s) => a + effPrice(s), 0);
  const totalDuration = selectedServices.reduce((a, s) => a + s.duration_min, 0);
  // aviso "traga seu material" não se aplica a barbearia (só salão de beleza/estética)
  const showBringOwnTools = salon.niche !== "barbearia" && selectedServices.some((s) => s.bring_own_tools);
  const selectedProducts = resaleProducts.filter((p) => selectedProductIds.includes(p.id));
  const productsTotal = selectedProducts.reduce((a, p) => a + Number(p.sale_price), 0);
  const anaCfg = getAnamnesisConfig(salon.niche as Niche);
  const anaNoneSelected = anaCfg.conditions.every((c) => !anaForm[c.key as ConditionKey]);

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
  // Taxa só entra no total quando é número, não promessa. Somar uma
  // estimativa aqui seria exatamente a surpresa que o fluxo evita.
  const taxaDomicilio = emCasa && kmConhecido != null ? homeServiceFee(kmConhecido, tarifa) : 0;
  // Primeiro domicílio dessa cliente: sai como PEDIDO, não como agendamento
  // fechado. Conhecendo o km, é agendamento normal com valor e tudo.
  const pedidoAConfirmar = emCasa && kmConhecido == null;
  // Celular BR de verdade. Sem isso não dá pra confirmar nada com essa pessoa
  // depois — e o banco agora recusa o cadastro, então validar aqui é o que
  // transforma um erro seco numa instrução.
  const [avisoModo, setAvisoModo] = useState<string | null>(null);
  const telefoneOk = toStoredPhone(phone) !== null;

  /** O que ainda falta para confirmar, na ordem em que a pessoa preencheria. */
  const faltaConfirmar = !telefoneOk
    ? "Falta seu celular — toque em Voltar para informar."
    : emCasa && !endereco.street.trim()
    ? "Informe o CEP para preenchermos a rua."
    : emCasa && !endereco.street_number.trim()
    ? "Falta o número do endereço."
    : null;
  const totalPriceLabel = hasOnRequest
    ? "A combinar"
    : (hasFrom ? "A partir de " : "") + formatBRL(totalPrice + taxaDomicilio);

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

  // Quem vai atender de fato. Com "Sem preferência" isso só se sabe depois do
  // horário: é quem tem aquele horário livre. É DERIVADO de propósito, nunca
  // gravado em `pro` — `pro` é a escolha da cliente e alimenta a busca de
  // horários. Guardar o resultado de volta na entrada refazia a busca, e a
  // busca começa limpando o horário: a cliente escolhia e perdia a escolha,
  // caindo numa tela em branco na confirmação.
  const proAtendente = anyPro ? (slot ? slotProMap[slot] ?? null : null) : pro;

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
      setProsLoaded(true);
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
      .select("id, url, caption")
      .eq("salon_id", salon.id)
      .order("sort_order")
      .then(({ data }) => setGallery((data as GalleryPhoto[]) ?? []));
    supabase.auth.getUser().then(async ({ data }) => {
      setTemChave(!!deviceToken(salon.slug, false));
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

  // Horários de um dia, com cache: a faixa de dias, a busca do próximo dia
  // livre e a grade pedem os mesmos dias, e no 3G cada ida ao servidor pesa.
  // Com "sem preferência" as profissionais são consultadas em paralelo (antes
  // era uma por vez) e a primeira da lista que tiver o horário fica com ele.
  type DiaSlots = { slots: string[]; map: Record<string, Professional> };
  const slotCache = useRef(new Map<string, Promise<DiaSlots>>());
  const proKey = anyPro ? `any:${eligiblePros.map((p) => p.id).join(",")}` : pro?.id ?? "";
  const fetchDay = useCallback((d: string): Promise<DiaSlots> => {
    const key = `${proKey}|${totalDuration}|${d}`;
    const hit = slotCache.current.get(key);
    if (hit) return hit;
    const run = (async (): Promise<DiaSlots> => {
      if (anyPro) {
        const res = await Promise.all(
          eligiblePros.map((p) =>
            supabase
              .rpc("get_availability", { p_salon: salon.id, p_member: p.id, p_date: d, p_duration: totalDuration })
              .then(({ data }) => ({ p, s: (data as string[]) ?? [] })),
          ),
        );
        const map: Record<string, Professional> = {};
        for (const { p, s } of res) for (const x of s) if (!map[x]) map[x] = p;
        return { slots: Object.keys(map).sort(), map };
      }
      const { data } = await supabase.rpc("get_availability", {
        p_salon: salon.id, p_member: pro!.id, p_date: d, p_duration: totalDuration,
      });
      return { slots: (data as string[]) ?? [], map: {} };
    })();
    // Erro não fica no cache: a próxima tentativa consulta de novo.
    run.catch(() => slotCache.current.delete(key));
    slotCache.current.set(key, run);
    return run;
  }, [supabase, salon.id, proKey, totalDuration, anyPro, eligiblePros, pro]);

  // Disponibilidade dos dias da faixa (quantos horários cada um tem) e o
  // próximo dia com vaga a partir do escolhido.
  const [diasComVaga, setDiasComVaga] = useState<Record<string, number>>({});
  const [proximoLivre, setProximoLivre] = useState<{ date: string; first: string } | "nenhum" | null>(null);

  // Entrou na etapa de horário: esquece o que estava em cache (a agenda muda).
  useEffect(() => {
    if (step === "time") slotCache.current.clear();
  }, [step]);

  const loadSlots = useCallback(async () => {
    if (!totalDuration || (!pro && !anyPro)) return;
    setLoadingSlots(true);
    setSlot(null);
    setProximoLivre(null);
    const pedido = date;
    try {
      const r = await fetchDay(pedido);
      // Troca rápida de dia: só a resposta do dia que está na tela vale.
      if (pedido !== dateRef.current) return;
      setSlotProMap(r.map);
      setSlots(r.slots);
    } finally {
      if (pedido === dateRef.current) setLoadingSlots(false);
    }
  }, [pro, date, totalDuration, anyPro, fetchDay]);

  useEffect(() => {
    if (step === "time") loadSlots();
  }, [step, date, loadSlots]);

  // Faixa de 7 dias: marca os que não têm vaga.
  useEffect(() => {
    if (step !== "time" || !totalDuration || (!pro && !anyPro)) return;
    let vivo = true;
    const dias = proximosDias(todayLocal(), 7);
    Promise.all(dias.map((d) => fetchDay(d).then((r) => [d, r.slots.length] as const).catch(() => null))).then((rs) => {
      if (!vivo) return;
      const m: Record<string, number> = {};
      for (const r of rs) if (r) m[r[0]] = r[1];
      setDiasComVaga(m);
    });
    return () => { vivo = false; };
  }, [step, fetchDay, totalDuration, pro, anyPro]);

  // Dia escolhido sem vaga: procura o próximo com horário (até ~1 mês),
  // em lotes de uma semana para não disparar tudo de uma vez.
  useEffect(() => {
    if (step !== "time" || loadingSlots || slots.length > 0 || !totalDuration || (!pro && !anyPro)) return;
    let vivo = true;
    (async () => {
      for (let semana = 0; semana < 4 && vivo; semana++) {
        const dias = proximosDias(somaDias(date, 1 + semana * 7), 7);
        const rs = await Promise.all(dias.map((d) => fetchDay(d).catch(() => null)));
        if (!vivo) return;
        const i = rs.findIndex((r) => r && r.slots.length > 0);
        if (i >= 0) {
          setProximoLivre({ date: dias[i], first: rs[i]!.slots[0] });
          return;
        }
      }
      if (vivo) setProximoLivre("nenhum");
    })();
    return () => { vivo = false; };
  }, [step, loadingSlots, slots.length, date, fetchDay, totalDuration, pro, anyPro]);

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
    // `p_phone` leva a chave do aparelho (nome antigo do parâmetro no banco).
    const ph = userId ? null : deviceToken(salon.slug, false);
    if (!userId && !ph) return;
    const [ap, wl] = await Promise.all([
      supabase.rpc("public_my_appointments" as never, { p_salon: salon.id, p_phone: ph } as never),
      supabase.rpc("public_my_waitlist" as never, { p_salon: salon.id, p_phone: ph } as never),
    ]);
    setMineErr(!!(ap.error || wl.error));
    if (!ap.error) setMine((ap.data as unknown as Appt[]) ?? []);
    if (!wl.error) setWaitlist((wl.data as unknown as WaitlistEntry[]) ?? []);
  }, [supabase, salon.id, salon.slug, userId]);

  // carrega o histórico em segundo plano assim que o cliente é conhecido —
  // alimenta a sugestão de profissional favorito sem precisar abrir "Meus".
  useEffect(() => {
    if (userId || deviceToken(salon.slug, false)) fetchMine();
  }, [userId, salon.slug, fetchMine]);

  // Lista de espera que virou vaga: para cada espera ativa, confere se o dia
  // pedido já tem horário livre (alguém desmarcou, o salão abriu mais). A
  // cliente vê isso ao abrir o link — o WhatsApp de "vaga liberada" só sai se
  // o salão tiver ligado, e nem todo salão tem WhatsApp conectado.
  const [vagasEspera, setVagasEspera] = useState<Record<string, string[]>>({});
  const esperaParaPedido = useCallback((w: WaitlistEntry) => {
    const svcIds = services.filter((sv) => w.services.includes(sv.name)).map((sv) => sv.id);
    const duracao = services.filter((sv) => svcIds.includes(sv.id)).reduce((a, sv) => a + sv.duration_min, 0);
    const aptas = pros.filter((p) =>
      proSvc.some((x) => x.member_id === p.id) &&
      svcIds.every((sid) => {
        const linked = proSvc.filter((x) => x.service_id === sid);
        return linked.length === 0 || linked.some((x) => x.member_id === p.id);
      }),
    );
    const quem = w.member_name ? aptas.filter((p) => p.display_name === w.member_name) : aptas;
    return { svcIds, duracao, quem, pedida: w.member_name ? quem[0] ?? null : null };
  }, [services, pros, proSvc]);

  useEffect(() => {
    const hoje = todayLocal();
    const ativas = waitlist.filter((w) => w.status === "waiting" && w.preferred_date >= hoje);
    if (!ativas.length || !services.length || !pros.length) { setVagasEspera({}); return; }
    let vivo = true;
    (async () => {
      const res: Record<string, string[]> = {};
      await Promise.all(ativas.map(async (w) => {
        const { duracao, quem } = esperaParaPedido(w);
        if (!duracao || !quem.length) return;
        const listas = await Promise.all(quem.map((p) =>
          supabase
            .rpc("get_availability", { p_salon: salon.id, p_member: p.id, p_date: w.preferred_date, p_duration: duracao })
            .then(({ data }) => (data as string[]) ?? []),
        ));
        const livres = [...new Set(listas.flat())].sort();
        if (livres.length) res[w.id] = livres;
      }));
      if (vivo) setVagasEspera(res);
    })();
    return () => { vivo = false; };
  }, [waitlist, services.length, pros.length, esperaParaPedido, supabase, salon.id]);

  // "Agendar agora" na espera: monta o pedido daquela espera e abre o dia.
  function agendarVaga(w: WaitlistEntry) {
    const { svcIds, pedida } = esperaParaPedido(w);
    if (!svcIds.length) return;
    setSelected(svcIds);
    if (pedida) { setAnyPro(false); setPro(pedida); }
    else { setAnyPro(true); setPro(null); }
    setDate(w.preferred_date);
    setShowMine(false);
    setStep("time");
  }

  async function joinWaitlist() {
    setJoiningWaitlist(true);
    setWaitlistErr(null);
    const { data: entrada, error } = await supabase.rpc("public_join_waitlist" as never, {
      p_salon: salon.id,
      p_client_name: name || "Cliente",
      p_client_phone: toE164(phone),
      p_service_ids: selected,
      p_date: date,
      p_member: anyPro ? null : (pro?.id ?? null),
    } as never);
    setJoiningWaitlist(false);
    if (error) {
      setWaitlistErr("Não foi possível entrar na lista de espera. Tente novamente.");
      return;
    }
    const entradaId = (entrada as unknown as { id?: string } | null)?.id;
    if (entradaId) {
      await supabase.rpc("public_claim_waitlist" as never, {
        p_id: entradaId,
        p_token: deviceToken(salon.slug, true),
      } as never);
      setTemChave(true);
    }
    try {
      localStorage.setItem(`af_client_${salon.slug}`, JSON.stringify({ name, phone, favoriteProId }));
    } catch { /* ignore */ }
    setSavedPhone(phone);
    setStep("waitlist_done");
    fetchMine();
  }

  function goWaitlist() {
    setWaitlistErr(null);
    // Mesma regra do agendamento (goAfterTime): só pula a identificação com
    // um celular válido. Cliente logada sem telefone no perfil mandava o
    // número vazio e o banco recusava — "não foi possível" sem saída.
    const contatoOk = userId ? toStoredPhone(phone) !== null : toStoredPhone(savedPhone) !== null;
    if (contatoOk) joinWaitlist();
    else { setAuthIntent("waitlist"); setStep("auth"); }
  }

  async function cancelWaitlistEntry(id: string) {
    if (!window.confirm("Sair da lista de espera desse dia?")) return;
    setCancelingWaitlistId(id);
    const { error } = await supabase.rpc("public_cancel_waitlist" as never, {
      p_id: id,
      p_phone: userId ? null : deviceToken(salon.slug, false),
    } as never);
    setCancelingWaitlistId(null);
    if (error) {
      setCancelErr("Não foi possível sair da lista de espera. Atualize e tente novamente.");
      return;
    }
    setCancelErr(null);
    await fetchMine();
  }

  async function loadMine() {
    await fetchMine();
    setMineTab("next");
    setShowMine(true);
  }

  // Com vaga aberta na espera, o ícone já abre direto nessa aba.
  async function abrirEspera() {
    await fetchMine();
    setMineTab("waitlist");
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
      p_phone: userId ? null : deviceToken(salon.slug, false),
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

  /**
   * Troca entre salão e domicílio.
   *
   * Ao ir pra domicílio, tira da seleção o que não sai do salão: senão a
   * pessoa segue com um serviço escolhido que sumiu da lista e o pedido é
   * recusado só no fim, sem ela entender o motivo.
   */
  function trocarModo(novo: "salon" | "home") {
    setModo(novo);
    setAvisoModo(null);
    if (novo === "home") {
      const permitidos = new Set(servicosEmCasa.map((s) => s.id));
      // Trocar para domicílio some com o que não sai do salão. Some em
      // silêncio era o problema: a pessoa escolheu três serviços, viu dois
      // desaparecerem e não sabia se tinha desmarcado sem querer.
      const removidos = services.filter(
        (sv) => selected.includes(sv.id) && !permitidos.has(sv.id),
      );
      if (removidos.length > 0) {
        setAvisoModo(
          removidos.length === 1
            ? `${removidos[0].name} não é feito fora do salão, então saiu da sua escolha.`
            : `${removidos.map((sv) => sv.name).join(", ")} não são feitos fora do salão, então saíram da sua escolha.`,
        );
      }
      setSelected((prev) => prev.filter((id) => permitidos.has(id)));
    }
  }

  // Endereço e quilometragem que o salão já tem dessa cliente. É o que faz a
  // segunda visita ser instantânea: chega tudo preenchido e com valor fechado.
  useEffect(() => {
    // Só o endereço de quem este aparelho já atendeu (ou da conta logada).
    const ph = deviceToken(salon.slug, false);
    if (!emCasa || (!ph && !userId)) return;
    let vivo = true;
    void (async () => {
      const { data } = await supabase.rpc("public_home_address" as never, {
        p_salon: salon.id,
        p_phone: ph,
      } as never);
      if (!vivo) return;
      const r = (data as HomeAddressRow[] | null)?.[0];
      // Sem registro pra ESTE telefone o km volta a ser desconhecido. Sair
      // cedo aqui deixaria na tela a quilometragem de outra pessoa — e ela
      // vira preço.
      if (!r) { setKmConhecido(null); return; }
      setKmConhecido(r.distance_km == null ? null : Number(r.distance_km));
      setEndereco((atual) =>
        // Não sobrescreve o que ela já começou a digitar agora.
        enderecoCompleto(atual)
          ? atual
          : {
              cep: r.cep ?? "",
              street: r.street ?? "",
              street_number: r.street_number ?? "",
              complement: r.complement ?? "",
              neighborhood: r.neighborhood ?? "",
              city: r.city ?? "",
              state: r.state ?? "",
            },
      );
    })();
    return () => { vivo = false; };
  }, [emCasa, supabase, salon.id, salon.slug, userId]);

  async function confirmBooking() {
    // Nunca sair em silêncio: um botão que não faz nada ao ser apertado é o
    // pior retorno possível — a pessoa aperta de novo achando que não pegou.
    if (!proAtendente || !slot) {
      setBookErr("Escolha profissional e horário antes de confirmar.");
      return;
    }
    if (!telefoneOk) {
      setBookErr("Confira seu celular: precisa ser um número com DDD.");
      setStep("auth");
      return;
    }
    setBooking(true);
    setBookErr(null);
    // produtos escolhidos não têm cobrança online — viram nota pra equipe
    // preparar/oferecer no balcão (visível na agenda/comanda).
    const productsNote =
      selectedProducts.length > 0
        ? `Produtos desejados: ${selectedProducts.map((p) => p.name).join(", ")}`
        : undefined;
    const { data, error } = await supabase.rpc("book_appointment", {
      p_salon: salon.id,
      p_member: proAtendente.id,
      p_service_ids: selected,
      p_starts_at: slot,
      p_client_name: name || "Cliente",
      p_client_phone: toE164(phone),
      ...(productsNote ? { p_notes: productsNote } : {}),
      ...(emCasa
        ? { p_service_mode: "home", p_address: endereco as unknown as Json }
        : {}),
    });
    if (error) {
      const m = error.message;
      // Todo erro que o `book_appointment` sabe levantar tem tradução. Faltavam
      // `telefone_invalido` e `client_busy`, e eram justamente os dois que a
      // pessoa consegue provocar sozinha — os dois caíam no texto genérico,
      // que não diz o que fazer e faz o agendamento parecer quebrado.
      setBookErr(
        m.includes("slot_taken")
          ? "Esse horário acabou de ser reservado. Escolha outro."
          : m.includes("telefone_invalido")
          ? "Confira seu celular: precisa ser um número com DDD."
          : m.includes("client_busy")
          ? "Você já tem outro atendimento nesse mesmo horário."
          : m.includes("home_address_required")
          ? "Confira o endereço: precisamos da rua e do número."
          : m.includes("service_not_home")
          ? "Um dos serviços escolhidos não é feito fora do salão."
          : m.includes("home_service_off")
          ? "O atendimento em domicílio não está disponível no momento."
          : m.includes("invalid_services") || m.includes("no_services")
          ? "Escolha pelo menos um serviço para continuar."
          : m.includes("invalid_member")
          ? "Essa profissional não está mais disponível. Escolha outra."
          : "Não foi possível concluir. Tente novamente.",
      );
      if (m.includes("telefone_invalido")) setStep("auth");
      setBooking(false);
      return;
    }
    setBooking(false);
    setBookedClientId(data?.client_id ?? null);
    // Liga o agendamento a este aparelho antes de tudo: inspiração, ficha e
    // "Meus agendamentos" dependem dessa ligação.
    const token = deviceToken(salon.slug, true);
    if (data?.id && token) {
      await supabase.rpc("public_claim_appointment" as never, {
        p_appointment: data.id,
        p_token: token,
      } as never);
      setTemChave(true);
    }
    // fotos de inspiração escolhidas na galeria — o profissional vê na Agenda
    if (inspirationIds.length > 0 && data?.id) {
      await supabase.rpc("public_set_appointment_inspiration" as never, {
        p_appointment: data.id,
        p_gallery_ids: inspirationIds,
        p_phone: userId ? null : token,
      } as never);
    }
    setStep("done");
    // Atualiza "Meus agendamentos" (e faz o ícone aparecer no primeiro agendamento).
    fetchMine();
  }

  function toggleInspiration(id: string) {
    setInspirationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // convite pra ficha de anamnese: só se o cliente ainda não tem uma (nem
  // preenchida pela equipe presencialmente) e não recusou recentemente.
  useEffect(() => {
    if (step !== "done" || !bookedClientId) return;
    try {
      const saved = localStorage.getItem(`af_client_${salon.slug}`);
      const parsed = saved ? JSON.parse(saved) : {};
      const dismissedAt = parsed.anamnesisDismissedAt as string | undefined;
      if (dismissedAt) {
        const days = (Date.now() - new Date(dismissedAt).getTime()) / 86_400_000;
        if (days < ANAMNESIS_COOLDOWN_DAYS) return;
      }
    } catch { /* ignore */ }
    const ph = userId ? null : deviceToken(salon.slug, false);
    supabase
      .rpc("public_needs_anamnesis" as never, { p_client_id: bookedClientId, p_phone: ph } as never)
      .then(({ data }) => {
        if (data === true) setAnamnesisFlow("invite");
      });
  }, [step, bookedClientId, supabase, salon.slug, userId]);

  function dismissAnamnesis() {
    setAnamnesisFlow(null);
    try {
      const saved = localStorage.getItem(`af_client_${salon.slug}`);
      const parsed = saved ? JSON.parse(saved) : {};
      localStorage.setItem(
        `af_client_${salon.slug}`,
        JSON.stringify({ ...parsed, anamnesisDismissedAt: new Date().toISOString() }),
      );
    } catch { /* ignore */ }
  }

  function setAnaField<K extends keyof AnamnesisForm>(k: K, v: AnamnesisForm[K]) {
    setAnaForm((f) => ({ ...f, [k]: v }));
  }

  async function saveAnamnesis() {
    if (!bookedClientId || !anaForm.consent_given) return;
    setSavingAnamnesis(true);
    setAnaErr(null);
    const ph = userId ? null : deviceToken(salon.slug, false);
    const { error } = await supabase.rpc("public_save_anamnesis" as never, {
      p_client_id: bookedClientId,
      p_consent_given: anaForm.consent_given,
      p_phone: ph,
      p_is_pregnant: anaForm.is_pregnant,
      p_is_breastfeeding: anaForm.is_breastfeeding,
      p_has_diabetes: anaForm.has_diabetes,
      p_has_hypertension: anaForm.has_hypertension,
      p_has_heart_condition: anaForm.has_heart_condition,
      p_has_coagulation_issue: anaForm.has_coagulation_issue,
      p_has_epilepsy: anaForm.has_epilepsy,
      p_has_cancer_treatment: anaForm.has_cancer_treatment,
      p_has_thyroid: anaForm.has_thyroid,
      p_allergies: anaForm.allergies || null,
      p_medications: anaForm.medications || null,
      p_recent_procedures: anaForm.recent_procedures || null,
      p_skin_hair_notes: anaForm.skin_hair_notes || null,
      p_general_notes: anaForm.general_notes || null,
      p_consent_name: anaForm.consent_name || null,
      p_alert_summary: computeAlertSummary(anaForm),
    } as never);
    setSavingAnamnesis(false);
    if (error) {
      setAnaErr("Não foi possível salvar. Tente novamente.");
      return;
    }
    setAnamnesisFlow("thanks");
  }

  /* ---------------- etapas, histórico e rascunho ---------------- */

  // Etapa mais adiante que o pedido atual permite — usada ao chegar por URL
  // (recarga, voltar/avançar do navegador) para nunca abrir uma tela vazia.
  const maxStep = useCallback((): Step => {
    if (!selected.length || emCasa) return "services";
    if (!pro && !anyPro) return "professional";
    if (!slot) return "time";
    return "confirm";
  }, [selected.length, emCasa, pro, anyPro, slot]);

  const passoNaUrl = () => new URLSearchParams(window.location.search).get("passo");
  function trocarUrl(alvo: Step, modo: "push" | "replace") {
    const url = new URL(window.location.href);
    const slug = STEP_SLUG[alvo];
    if (slug) url.searchParams.set("passo", slug);
    else url.searchParams.delete("passo");
    if (modo === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  // Restaura o rascunho uma vez, quando serviços e equipe chegaram, e abre na
  // etapa da URL (recarga) — limitada ao que o rascunho permite. O horário
  // não volta: a vaga pode ter sido ocupada nesse meio-tempo.
  useEffect(() => {
    if (restored || loadingServices || !prosLoaded) return;
    let inicial: Step = "services";
    try {
      const raw = sessionStorage.getItem(draftKey(salon.slug));
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        const valid = d.selected.filter((id) => services.some((sv) => sv.id === id));
        const proSalvo = d.proId ? pros.find((p) => p.id === d.proId) ?? null : null;
        if (valid.length) {
          setSelected(valid);
          setModo(d.modo === "home" ? "home" : "salon");
          if (d.anyPro) setAnyPro(true);
          else if (proSalvo) setPro(proSalvo);
          if (d.date && d.date >= todayLocal()) setDate(d.date);
          const pedido = SLUG_STEP[passoNaUrl() ?? ""] ?? "services";
          const lim: Step = d.modo === "home" ? "services" : d.anyPro || proSalvo ? "time" : "professional";
          inicial = STEP_ORDER.indexOf(pedido) <= STEP_ORDER.indexOf(lim) ? pedido : lim;
        }
      }
    } catch { /* rascunho ilegível: começa do zero */ }
    if (inicial !== step) setStep(inicial);
    if ((STEP_SLUG[inicial] ?? null) !== passoNaUrl()) trocarUrl(inicial, "replace");
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez
  }, [restored, loadingServices, prosLoaded]);

  // Guarda o rascunho a cada escolha. Agendou: apaga.
  useEffect(() => {
    if (!restored) return;
    try {
      if (step === "done" || step === "waitlist_done" || !selected.length) {
        sessionStorage.removeItem(draftKey(salon.slug));
        return;
      }
      const d: Draft = { selected, proId: pro?.id ?? null, anyPro, date, modo };
      sessionStorage.setItem(draftKey(salon.slug), JSON.stringify(d));
    } catch { /* navegação privada sem storage: segue sem rascunho */ }
  }, [restored, step, selected, pro, anyPro, date, modo, salon.slug]);

  // URL → etapa: botões voltar/avançar do navegador. Lê a URL real (o
  // `passo` do hook só serve de gatilho: o Next pode atualizá-lo um render
  // depois do pushState).
  useEffect(() => {
    if (!restored) return;
    const alvo = SLUG_STEP[passoNaUrl() ?? ""] ?? "services";
    if (alvo === step) return;
    if (step === "done" || step === "waitlist_done") {
      // Voltar depois de agendar não reabre a confirmação (agendaria de novo).
      recomecar();
      return;
    }
    const lim = maxStep();
    const destino = STEP_ORDER.indexOf(alvo) <= STEP_ORDER.indexOf(lim) ? alvo : lim;
    // Etapa que o pedido não sustenta: corrige a URL sem criar entrada nova,
    // senão o voltar do celular nunca conseguiria sair da página.
    if (destino !== alvo) trocarUrl(destino, "replace");
    if (destino === step) return;
    if (STEP_ORDER.indexOf(destino) < STEP_ORDER.indexOf(step)) depthRef.current = Math.max(0, depthRef.current - 1);
    else depthRef.current += 1;
    setStep(destino);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só à URL
  }, [passo, restored]);

  // Etapa → URL: cada avanço ganha uma entrada no histórico. As telas finais
  // não mexem na URL — voltar delas cai no efeito acima e recomeça.
  useEffect(() => {
    if (!restored || step === "done" || step === "waitlist_done") return;
    if ((STEP_SLUG[step] ?? null) === passoNaUrl()) return;
    if (replaceNextRef.current) {
      replaceNextRef.current = false;
      trocarUrl(step, "replace");
    } else {
      trocarUrl(step, "push");
      depthRef.current += 1;
    }
  }, [step, restored]);

  /** "Voltar" da tela: usa o histórico enquanto houver etapa nossa atrás. */
  function voltar(fallback: Step) {
    if (depthRef.current > 0) window.history.back();
    else setStep(fallback);
  }

  function recomecar() {
    setSelected([]);
    setSelectedProductIds([]);
    setInspirationIds([]);
    setPro(null);
    setAnyPro(false);
    setSlot(null);
    depthRef.current = 0;
    replaceNextRef.current = true;
    setStep("services");
  }

  function goAfterTime() {
    setAuthIntent("book");
    // O telefone salvo no navegador precisa ser RECONFERIDO antes de pular a
    // identificação. Ele veio do localStorage, pode ter sido gravado antes de
    // existirem as regras de telefone, ou ter ficado pela metade. Quem pulava
    // com um número quebrado chegava na confirmação, apertava o botão e levava
    // "Não foi possível concluir" sem nenhuma pista — o `book_appointment`
    // recusa com `telefone_invalido` logo na primeira linha.
    const contatoOk = userId ? toStoredPhone(phone) !== null : toStoredPhone(savedPhone) !== null;
    if (contatoOk) setStep("confirm");
    else setStep("auth");
  }

  /* ---------------- render ---------------- */
  return (
    <div className="max-w-xl mx-auto px-4 pb-40">
      {/* Cabeçalho: quem chega pelo link precisa saber em que salão está
          antes de escolher qualquer coisa. Antes a identidade só aparecia na
          revisão final — a cliente montava o pedido sem ver de quem era. */}
      <header className="pt-5 pb-5">
        <div className="flex items-center gap-3.5">
          {salon.logo_url ? (
            <NextImage
              src={salon.logo_url}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl object-cover border border-border shrink-0"
            />
          ) : (
            <span aria-hidden className="grid place-items-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground font-display text-2xl shrink-0">
              {salon.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl sm:text-2xl leading-tight truncate">{salon.name}</p>
            {(salon.address || salon.city) && (
              <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{salon.address || salon.city}</span>
              </p>
            )}
          </div>
          <div className="flex items-center shrink-0 -mr-2">
            {/* Redes primeiro: são do salão, e galeria/meus agendamentos são
                ferramentas de quem está navegando. */}
            <SocialLinksRow salon={salon} variant="cabecalho" />
            {gallery.length > 0 && (
              <button
                onClick={() => { setGalleryStart(0); setShowGallery(true); }}
                aria-label="Ver galeria de fotos"
                className="grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <Images className="h-[18px] w-[18px]" />
              </button>
            )}
            {/* Para toda cliente já identificada neste aparelho. Esconder quando
                a lista vinha vazia tirava o acesso de quem já era cliente: com a
                chave do aparelho, os agendamentos antigos não aparecem aqui. */}
            {(userId || savedPhone || temChave) && (
              <button
                onClick={() => (Object.keys(vagasEspera).length > 0 ? abrirEspera() : loadMine())}
                aria-label={Object.keys(vagasEspera).length > 0 ? "Meus agendamentos, abriu vaga na sua lista de espera" : "Meus agendamentos"}
                className="relative grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <ClockCounterClockwise className="h-[18px] w-[18px]" />
                {Object.keys(vagasEspera).length > 0 && (
                  <span aria-hidden className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Saudação de quem volta — uma linha, sem competir com o salão */}
        {step === "services" && (userId || savedPhone) && clientName && (
          <p className="mt-4 text-sm text-muted-foreground af-rise">
            Olá, <span className="font-semibold text-foreground">{clientName.split(" ")[0]}</span>! Que bom te ver de novo.
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
            <Sparkle className="h-5 w-5 text-primary" /> Escolha os serviços
          </h2>

          {/* Trabalhos do salão à vista, não atrás de um ícone: é o que a
              cliente quer ver antes de decidir. Tocar abre a foto grande, onde
              ela pode marcar como inspiração pro profissional. */}
          {gallery.length > 0 && (
            <div className="pb-1">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <p className="text-sm font-semibold">Trabalhos do salão</p>
                <button
                  type="button"
                  onClick={() => { setGalleryStart(0); setShowGallery(true); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Ver todas ({gallery.length})
                </button>
              </div>
              <ul className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1" aria-label="Fotos de trabalhos do salão">
                {gallery.map((g, i) => {
                  const sel = inspirationIds.includes(g.id);
                  return (
                    <li key={g.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => { setGalleryStart(i); setShowGallery(true); }}
                        aria-label={`Ver foto ${i + 1}${g.caption ? `: ${g.caption}` : ""}${sel ? " (escolhida como inspiração)" : ""}`}
                        className={`relative block h-28 w-24 overflow-hidden rounded-[var(--radius)] border bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${sel ? "border-primary ring-2 ring-primary" : "border-border"}`}
                      >
                        <NextImage src={g.url} alt="" fill sizes="96px" className="object-cover" />
                        {sel && (
                          <span aria-hidden className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                            <Heart className="h-3.5 w-3.5" weight="fill" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {inspirationIds.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Heart aria-hidden className="h-3.5 w-3.5 text-primary" weight="fill" />
                  {inspirationIds.length === 1 ? "1 foto escolhida" : `${inspirationIds.length} fotos escolhidas`} como inspiração — o profissional vai ver.
                </p>
              )}
            </div>
          )}

          {/* A modalidade vem ANTES dos serviços de propósito: escolhendo
              domicílio, a lista já mostra só o que sai do salão. O caminho
              inverso deixaria escolher pra recusar depois. */}
          {podeDomicilio && (
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "salon", Icon: Storefront, label: "No espaço", hint: "Você vem até nós" },
                { id: "home", Icon: House, label: "Em domicílio", hint: "A gente vai até você" },
              ] as const).map(({ id, Icon, label, hint }) => {
                const on = modo === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => trocarModo(id)}
                    aria-pressed={on}
                    className={`rounded-[var(--radius)] border p-3 text-left transition ${
                      on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${on ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="mt-1.5 text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Região viva: trocar a modalidade reescreve a lista de serviços
              inteira, e quem não vê a tela não percebe a mudança. */}
          {emCasa && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-[var(--radius)] border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
            >
              Mostrando só os serviços que fazemos na sua casa. Deslocamento:{" "}
              <b className="text-foreground">{regraTarifa(tarifa)}</b>.
              {avisoModo && <span className="mt-1 block text-amber-700 dark:text-amber-400">{avisoModo}</span>}
            </p>
          )}

          {/* Filtro de categoria (dropdown) + atalho pra loja de produtos */}
          {(categories.length > 0 || resaleProducts.length > 0) && (
            <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm flex items-center gap-2">
              {categories.length > 0 ? (
                <Select
                  value={activeCategory ?? ""}
                  onValueChange={(v) => setActiveCategory(v || null)}
                  className="flex-1"
                >
                  <option value="">Todos os serviços</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              ) : (
                <div className="flex-1" />
              )}
              {resaleProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("produtos-sugeridos")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="shrink-0 inline-flex items-center gap-1.5 h-11 rounded-[var(--radius)] border border-border bg-card hover:border-foreground/25 px-3.5 text-sm font-medium transition"
                >
                  <Package className="h-4 w-4" /> Loja
                </button>
              )}
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
          {servicosVisiveis.filter((s) => activeCategory === null || s.category_id === activeCategory).map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleService(s.id)}
                className={`w-full text-left rounded-[var(--radius)] border p-4 transition flex items-center gap-3 ${
                  on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <span className={`grid place-items-center h-6 w-6 rounded-full border-2 shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-foreground/25"}`}>
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

          {/* Aviso: cliente pode trazer o próprio material (manicure/pedicure) */}
          {showBringOwnTools && (
            <div className="rounded-[var(--radius)] border border-primary/25 bg-primary/5 p-4 flex items-start gap-3 af-rise">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90">
                <span aria-hidden>💅 </span>
                Se você tiver seu próprio alicate ou esmalte e quiser trazer, fique à vontade — é
                sempre a opção mais segura para itens de uso pessoal. De qualquer forma, seguimos
                todos os protocolos de higienização e esterilização dos nossos materiais.
              </p>
            </div>
          )}

          {/* Sugestão de produto (revenda do estoque) para os serviços escolhidos */}
          {selected.length > 0 && resaleProducts.length > 0 && (
            <div id="produtos-sugeridos" className="pt-2 space-y-2 scroll-mt-16">
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
                      aria-pressed={on}
                      className={`shrink-0 w-36 text-left rounded-[var(--radius)] border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                        on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                      }`}
                    >
                      <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold text-primary">{formatBRL(Number(p.sale_price))}</span>
                        <span aria-hidden className={`grid place-items-center h-5 w-5 rounded-full border shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
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
              type="button"
              onClick={() => { setAnyPro(true); setPro(null); setTimeout(() => setStep("time"), 280); }}
              aria-pressed={anyPro}
              className={`flex w-full items-center gap-3 rounded-[var(--radius)] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
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
              {anyPro && <Check aria-hidden className="h-5 w-5 text-primary" />}
            </button>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sortedEligiblePros.map((p) => {
              const on = !anyPro && pro?.id === p.id;
              const isFavorite = favoriteProId === p.id;
              const isSuggested = !favoriteProId && suggestedProId === p.id;
              return (
                /* O coração era um `role="button"` DENTRO do botão do cartão —
                   HTML inválido (controle dentro de controle) e imprevisível
                   no teclado e no leitor de tela: às vezes favoritava, às
                   vezes escolhia a profissional. Agora são dois botões irmãos
                   dentro de um invólucro posicionado. */
                <div key={p.id} className="relative">
                  <button
                    type="button"
                    onClick={() => { setAnyPro(false); setPro(p); setTimeout(() => setStep("time"), 280); }}
                    aria-pressed={on}
                    className={`flex w-full flex-col items-center gap-2 rounded-[var(--radius)] border p-4 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                      on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    {on && <Check aria-hidden className="absolute top-2 right-2 h-4 w-4 text-primary" />}
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
                  <button
                    type="button"
                    onClick={() => toggleFavoritePro(p.id)}
                    aria-pressed={isFavorite}
                    aria-label={
                      isFavorite
                        ? `Desmarcar ${p.display_name} como favorita`
                        : `Marcar ${p.display_name} como favorita`
                    }
                    className="absolute top-2 left-2 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Heart aria-hidden className="h-4 w-4" weight={isFavorite ? "fill" : "regular"} style={isFavorite ? { color: "#ef4444" } : undefined} />
                  </button>
                </div>
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
            <DateRuler value={date} onChange={setDate} vagas={diasComVaga} />
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="text-primary text-sm font-medium hover:underline"
            >
              Ver mais datas →
            </button>
          </div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{formatDateLong(date + "T12:00:00")}</p>
          {loadingSlots ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <CircleNotch className="h-6 w-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground space-y-3">
              <p>Sem horários livres nesse dia.</p>
              {/* Antes era "ver próximo dia", um dia por toque — e o próximo
                  podia estar fechado também. Agora vai direto ao primeiro
                  dia que tem vaga. */}
              {proximoLivre === null ? (
                <p className="flex items-center justify-center gap-2 text-xs">
                  <CircleNotch aria-hidden className="h-3.5 w-3.5 animate-spin" /> Procurando o próximo horário livre…
                </p>
              ) : proximoLivre === "nenhum" ? (
                <p className="text-xs">Nenhum horário livre nas próximas semanas.</p>
              ) : (
                <Button size="sm" className="mx-auto" onClick={() => setDate(proximoLivre.date)}>
                  Próximo livre: {formatDiaCurto(proximoLivre.date)} às {formatHora(proximoLivre.first)}
                  <CaretRight aria-hidden className="h-4 w-4" />
                </Button>
              )}
              <div className="pt-2 border-t border-border">
                <p className="text-xs mb-2">Quer esse dia mesmo assim? Entre na lista de espera — avisamos a equipe se abrir um horário.</p>
                <Button variant="outline" size="sm" onClick={goWaitlist} disabled={joiningWaitlist}>
                  {joiningWaitlist && <CircleNotch className="h-4 w-4 animate-spin" />} Entrar na lista de espera
                </Button>
                {waitlistErr && <p className="text-xs text-red-600 mt-2">{waitlistErr}</p>}
              </div>
            </Card>
          ) : (
            <SlotGrid
              key={date}
              slots={slots}
              selected={slot}
              onSelect={(s) => {
                setSlot(s);
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
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(maskBrPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                aria-invalid={phone.length > 0 && !telefoneOk}
              />
              {/* Só reclama depois de a pessoa ter digitado o bastante pra
                  valer a pena — avisar no primeiro dígito é ruído. */}
              {phone.replace(/\D/g, "").length >= 10 && !telefoneOk && (
                <p className="mt-1 text-xs text-red-600">
                  Confira o número: precisa ser um celular com DDD.
                </p>
              )}
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
                if (authIntent === "waitlist") joinWaitlist();
                else setStep("confirm");
              }}
              disabled={!name || !telefoneOk || joiningWaitlist}
            >
              {joiningWaitlist && <CircleNotch className="h-4 w-4 animate-spin" />} Continuar
            </Button>
            {/* A lista de espera também passa por aqui: o erro dela aparecia
                só na tela de horário, e daqui o botão não dava retorno. */}
            {authIntent === "waitlist" && waitlistErr && (
              <p role="alert" className="text-sm text-red-600 text-center">{waitlistErr}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              É por ele que a confirmação e o lembrete chegam. Sem um número
              válido, não conseguimos te avisar de nada.
            </p>
            <button
              type="button"
              onClick={() => voltar("time")}
              className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition"
            >
              <CaretLeft className="h-4 w-4" /> Voltar
            </button>
          </Card>
        </section>
      )}

      {/* STEP: confirmação */}
      {step === "confirm" && proAtendente && slot && (
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
              <BookingAvatar p={proAtendente} size={48} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Profissional</p>
                <p className="font-medium truncate">{proAtendente.display_name}</p>
              </div>
            </div>
            <Row label="Data" value={<span className="inline-block first-letter:uppercase">{formatDateLong(slot)}</span>} />
            <Row
              label="Horário"
              value={new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            />
            {emCasa && (
              <div className="border-t border-border pt-4">
                <HomeAddressForm
                  value={endereco}
                  onChange={setEndereco}
                  tarifa={tarifa}
                  kmConhecido={kmConhecido}
                  maxKm={salon.home_max_km == null ? null : Number(salon.home_max_km)}
                  terms={salon.home_terms ?? null}
                  salonCity={salon.city ?? null}
                />
              </div>
            )}
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
            {taxaDomicilio > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <House className="h-3.5 w-3.5" /> Deslocamento
                </span>
                <span className="text-muted-foreground">{formatBRL(taxaDomicilio)}</span>
              </div>
            )}
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
            {inspirationIds.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Heart className="h-3.5 w-3.5 text-primary" weight="fill" /> Inspiração — o profissional vai ver estas fotos
                </p>
                <div className="flex gap-2 flex-wrap">
                  {gallery.filter((g) => inspirationIds.includes(g.id)).map((g) => (
                    <span key={g.id} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                      <NextImage src={g.url} alt={g.caption ?? ""} fill sizes="64px" className="object-cover" />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
          {/* role="alert" para o erro chegar em leitor de tela: quem não vê a
              tela apertava o botão e ficava sem retorno nenhum. */}
          {bookErr && (
            <p role="alert" className="text-sm text-red-600">{bookErr}</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => voltar("time")} disabled={booking}>
              <CaretLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={confirmBooking}
              disabled={booking || !!faltaConfirmar}
              aria-describedby={faltaConfirmar ? "confirm-falta" : undefined}
            >
              {booking && <CircleNotch className="h-4 w-4 animate-spin" />}
              {pedidoAConfirmar ? "Enviar pedido" : "Confirmar agendamento"}
            </Button>
          </div>
          {/* Botão travado sem motivo é o que faz a pessoa achar que o sistema
              quebrou — e some por completo para quem usa leitor de tela. */}
          {faltaConfirmar && (
            <p id="confirm-falta" className="text-center text-xs text-muted-foreground">
              {faltaConfirmar}
            </p>
          )}
        </section>
      )}

      {/* STEP: concluído */}
      {step === "done" && (
        <section className="af-rise text-center py-10">
          <div className="grid place-items-center h-20 w-20 rounded-full bg-primary text-primary-foreground mx-auto af-float">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold mt-6">
            {pedidoAConfirmar ? "Pedido enviado!" : "Agendamento confirmado!"}
          </h2>
          {pedidoAConfirmar ? (
            <>
              {/* Dizer "confirmado" aqui seria prometer o que ninguém confirmou:
                  falta a profissional dizer se vai nesse endereço e nesse
                  horário, e o valor do deslocamento vai junto da resposta. */}
              <p className="font-display text-lg mt-2">
                {salon.name} recebeu seu pedido <span aria-hidden>🏠</span>
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                Vamos conferir a distância até{" "}
                <b className="text-foreground">{endereco.street}, {endereco.street_number}</b>{" "}
                e te mandar o valor do deslocamento pelo WhatsApp. O horário{" "}
                {slot && (
                  <b className="capitalize">
                    de {formatDateLong(slot)} às{" "}
                    {new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </b>
                )}{" "}
                fica reservado até lá.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-lg mt-2">
                {salon.name} agradece o seu agendamento! <span aria-hidden>💈</span>
              </p>
              <p className="text-muted-foreground mt-1">
                {proAtendente?.display_name} te espera{" "}
                {slot && (
                  <b className="capitalize">
                    {formatDateLong(slot)} às{" "}
                    {new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </b>
                )}
                .
              </p>
            </>
          )}
          <div className="flex flex-col gap-2 mt-8">
            <Button onClick={loadMine}>
              <ClockCounterClockwise className="h-4 w-4" /> Ver meus agendamentos
            </Button>
            <Button
              variant="outline"
              onClick={recomecar}
            >
              Agendar outro
            </Button>
          </div>

          <SocialLinksRow salon={salon} variant="confirmado" />
        </section>
      )}

      {/* STEP: entrou na lista de espera */}
      {step === "waitlist_done" && (
        <section className="af-rise text-center py-10">
          <div className="grid place-items-center h-20 w-20 rounded-full bg-primary text-primary-foreground mx-auto af-float">
            <Clock className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold mt-6">Você entrou na lista de espera!</h2>
          <p className="text-muted-foreground mt-1">
            Se abrir um horário{" "}
            <b className="capitalize">{formatDateLong(date + "T12:00:00")}</b>{" "}
            com {pro?.display_name ?? "a equipe"}, {salon.name} vai te chamar.
          </p>
          <div className="flex flex-col gap-2 mt-8">
            <Button onClick={loadMine}>
              <ClockCounterClockwise className="h-4 w-4" /> Ver meus agendamentos
            </Button>
            <Button
              variant="outline"
              onClick={recomecar}
            >
              Agendar outro
            </Button>
          </div>
        </section>
      )}

      {/* Barra inferior de navegação */}
      {/* Some com a gaveta aberta: ela é por cima, e o "Continuar" aparecia
          no fundo durante a troca de abas. */}
      {!showMine && (step === "services" || step === "professional" || step === "time") && (
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
            if (step === "professional") voltar("services");
            else if (step === "time") voltar("professional");
          }}
          onNext={() => {
            if (step === "services") setStep("professional");
            else if (step === "professional") setStep("time");
            else if (step === "time") goAfterTime();
          }}
        />
      )}

      {/* Drawer: meus agendamentos */}
      <AnimatePresence>
        {showMine && (
          <MineDrawer
            key="mine"
            mine={mine}
            waitlist={waitlist}
            tab={mineTab}
            onTabChange={setMineTab}
            onClose={() => { setShowMine(false); setCancelErr(null); }}
            onCancelWaitlist={cancelWaitlistEntry}
            cancelingWaitlistId={cancelingWaitlistId}
            onCancelAppt={cancelAppt}
            cancelingId={cancelingId}
            cancelErr={cancelErr}
            mineErr={mineErr}
            dicaAparelho={!userId}
            vagasEspera={vagasEspera}
            onAgendarVaga={agendarVaga}
          />
        )}
      </AnimatePresence>

      {/* Modal: galeria de fotos */}
      {showGallery && gallery.length > 0 && (
        <GalleryModal
          photos={gallery}
          startIndex={galleryStart}
          selectedIds={inspirationIds}
          onToggle={toggleInspiration}
          onClose={() => setShowGallery(false)}
        />
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

      {/* Modal: convite pra ficha de anamnese (só na primeira vez) */}
      {anamnesisFlow && (
        <MotionModal onClose={dismissAnamnesis}>
          <Card className="w-full sm:max-w-md mx-auto max-h-[85vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
            {anamnesisFlow === "invite" && (
              <div className="text-center space-y-3 py-2">
                <div className="grid place-items-center h-14 w-14 rounded-full bg-secondary text-secondary-foreground mx-auto">
                  <Heartbeat className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold">Podemos te conhecer melhor?</h3>
                <p className="text-sm text-muted-foreground">
                  Perguntamos isso só na primeira vez — ajuda a gente a te atender de um jeito
                  mais preparado e seguro. Leva menos de um minuto.
                </p>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={dismissAnamnesis}>Mais tarde</Button>
                  <Button className="flex-1" onClick={() => setAnamnesisFlow("conditions")}>Vamos lá</Button>
                </div>
              </div>
            )}

            {anamnesisFlow === "conditions" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-bold">Alguma dessas situações se aplica a você?</h3>
                  <p className="text-xs text-muted-foreground mt-1">Pode marcar mais de uma, ou nenhuma.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cleared = { ...anaForm };
                      for (const c of anaCfg.conditions) cleared[c.key as ConditionKey] = false;
                      setAnaForm(cleared);
                    }}
                    className={`col-span-full flex items-center gap-2.5 rounded-[var(--radius)] border p-3 text-left text-sm font-medium transition ${
                      anaNoneSelected ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className={`grid place-items-center h-5 w-5 rounded-full border shrink-0 ${anaNoneSelected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                      {anaNoneSelected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    Nenhuma dessas se aplica a mim
                  </button>
                  {anaCfg.conditions.map((c) => {
                    const on = anaForm[c.key as ConditionKey];
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setAnaField(c.key as ConditionKey, !on)}
                        className={`flex items-center gap-2.5 rounded-[var(--radius)] border p-3 text-left text-sm transition ${
                          on ? "border-primary ring-2 ring-primary/25 bg-secondary/40" : "border-border bg-card hover:border-foreground/20"
                        }`}
                      >
                        <span className={`grid place-items-center h-5 w-5 rounded border shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={dismissAnamnesis}>Pular</Button>
                  <Button className="flex-1" onClick={() => setAnamnesisFlow("details")}>Continuar</Button>
                </div>
              </div>
            )}

            {anamnesisFlow === "details" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-bold">Mais alguma coisa que a gente deveria saber?</h3>
                  <p className="text-xs text-muted-foreground mt-1">Tudo opcional — pode deixar em branco se não se aplicar.</p>
                </div>
                {anaCfg.textFields.map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`ana-${key}`}>{label}</Label>
                    <Textarea
                      id={`ana-${key}`}
                      rows={2}
                      value={anaForm[key]}
                      onChange={(e) => setAnaField(key, e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <div className="rounded-[var(--radius)] border border-border p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anaForm.consent_given}
                      onChange={(e) => setAnaField("consent_given", e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      Declaro que as informações acima são verdadeiras e autorizo o uso desses
                      dados de saúde para o meu atendimento, conforme a LGPD.
                    </span>
                  </label>
                </div>
                {anaErr && <p className="text-sm text-red-600">{anaErr}</p>}
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={() => setAnamnesisFlow("conditions")} disabled={savingAnamnesis}>
                    <CaretLeft className="h-4 w-4" />
                  </Button>
                  <Button className="flex-1" onClick={saveAnamnesis} disabled={savingAnamnesis || !anaForm.consent_given}>
                    {savingAnamnesis && <CircleNotch className="h-4 w-4 animate-spin" />} Concluir
                  </Button>
                </div>
              </div>
            )}

            {anamnesisFlow === "thanks" && (
              <div className="text-center space-y-3 py-4">
                <div className="grid place-items-center h-14 w-14 rounded-full bg-primary text-primary-foreground mx-auto">
                  <Check className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl font-bold">Prontinho!</h3>
                <p className="text-sm text-muted-foreground">
                  Isso vai ajudar bastante no seu próximo atendimento. Obrigado por compartilhar! 🙌
                </p>
                <Button className="mt-2" onClick={() => setAnamnesisFlow(null)}>Fechar</Button>
              </div>
            )}
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
      <span className="grid place-items-center rounded-full font-semibold shrink-0"
        // Sem cor própria cai na do salão — e aí o texto tem que ser o par
        // dela: no tema Preto o fundo é quase branco e o "R" sumia.
        style={{
          width: size, height: size, fontSize: Math.round(size * 0.4),
          background: p.color || "var(--primary)",
          color: p.color ? "#ffffff" : "var(--primary-foreground)",
        }}>
        {p.display_name?.charAt(0) ?? "?"}
      </span>
    );
  }
}

/**
 * Gaveta "Meus agendamentos". Fica fora do BookingApp de propósito: declarada
 * lá dentro, cada render da página criava um componente novo, e trocar de aba
 * desmontava e remontava o modal inteiro — piscava e deixava ver o botão
 * "Continuar" por trás.
 */
const HISTORICO_PAGINA = 5;

function MineDrawer({
  mine,
  waitlist,
  tab,
  onTabChange,
  onClose,
  onCancelWaitlist,
  cancelingWaitlistId,
  onCancelAppt,
  cancelingId,
  cancelErr,
  mineErr,
  dicaAparelho,
  vagasEspera,
  onAgendarVaga,
}: {
  mine: Appt[];
  waitlist: WaitlistEntry[];
  tab: MineTab;
  onTabChange: (t: MineTab) => void;
  onClose: () => void;
  onCancelWaitlist: (id: string) => void;
  cancelingWaitlistId: string | null;
  onCancelAppt: (a: Appt) => void;
  cancelingId: string | null;
  cancelErr: string | null;
  mineErr: boolean;
  /** cliente sem conta: explica que a lista é deste aparelho */
  dicaAparelho: boolean;
  /** horários livres hoje no dia de cada espera (id → horários) */
  vagasEspera: Record<string, string[]>;
  onAgendarVaga: (w: WaitlistEntry) => void;
}) {
  // Histórico longo: mostra aos poucos; volta ao começo ao trocar de aba.
  const [qtdHistorico, setQtdHistorico] = useState(HISTORICO_PAGINA);
  // Hora fixada na abertura da gaveta (não muda a cada render).
  const [agora] = useState(() => Date.now());
  // Em andamento conta como próximo até terminar (antes ia para o
  // histórico no minuto em que começava).
  const isUpcoming = (a: Appt) =>
    a.status === "in_progress"
      ? new Date(a.ends_at).getTime() > agora
      : UPCOMING_STATUSES.has(a.status) && new Date(a.starts_at).getTime() > agora;
  // O banco devolve do mais recente para o mais antigo — certo para o
  // histórico; nos próximos, o de amanhã vem primeiro.
  const filtered = mine
    .filter((a) => (tab === "next" ? isUpcoming(a) : !isUpcoming(a)))
    .sort((x, y) => (tab === "next" ? 1 : -1) * (new Date(x.starts_at).getTime() - new Date(y.starts_at).getTime()));
  // Espera de um dia que já passou não espera mais nada.
  const hoje = todayLocal();
  const waiting = waitlist.filter((w) => w.status === "waiting" && w.preferred_date >= hoje);
  // Status de um horário que já passou e ninguém fechou no salão: "Aguardando"
  // ali soava como se ainda fosse acontecer.
  const statusLabel = (a: Appt) =>
    !isUpcoming(a) && (a.status === "pending" || a.status === "confirmed")
      ? "Não finalizado"
      : STATUS_LABEL[a.status] ?? a.status;
  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[80vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Meus agendamentos</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        <div className="flex gap-1.5 mb-4 rounded-full bg-muted p-1">
          {(["next", "history", "waitlist"] as MineTab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setQtdHistorico(HISTORICO_PAGINA); onTabChange(t); }}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "next" ? "Próximos" : t === "history" ? "Histórico" : "Espera"}
              {t === "waitlist" && waiting.some((w) => vagasEspera[w.id]) && (
                <span aria-label="abriu vaga" className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
              )}
            </button>
          ))}
        </div>
        {cancelErr && (
          <div role="alert" className="mb-3 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
            {cancelErr}
          </div>
        )}
        {mineErr && (
          <div role="alert" className="mb-3 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
            Não conseguimos carregar seus agendamentos agora. Feche e abra de novo em instantes.
          </div>
        )}
        {mineErr && waiting.length === 0 && filtered.length === 0 ? null : tab === "waitlist" ? (
          waiting.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Você não está em nenhuma lista de espera.
            </p>
          ) : (
            <div className="space-y-3">
              {waiting.map((w) => (
                <div key={w.id} className="rounded-[var(--radius)] border border-border p-4">
                  <div className="flex justify-between items-start">
                    <p className="font-medium first-letter:uppercase">{formatDateLong(w.preferred_date + "T12:00:00")}</p>
                    <span className="text-xs rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                      Aguardando
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{w.member_name ?? "Qualquer profissional"}</p>
                  {w.services.length > 0 && <p className="text-sm mt-1">{w.services.join(", ")}</p>}
                  {vagasEspera[w.id] && (
                    <div role="status" className="mt-3 rounded-[var(--radius)] border border-emerald-600/30 bg-emerald-600/10 p-3">
                      <p className="text-sm font-semibold text-emerald-800">Abriu horário nesse dia!</p>
                      <p className="text-xs text-emerald-800/80 mt-0.5">
                        {vagasEspera[w.id].slice(0, 4).map(formatHora).join(" · ")}
                        {vagasEspera[w.id].length > 4 ? ` e mais ${vagasEspera[w.id].length - 4}` : ""}
                      </p>
                      <Button size="sm" className="mt-2.5 w-full" onClick={() => onAgendarVaga(w)}>
                        Agendar agora
                      </Button>
                    </div>
                  )}
                  <button
                    onClick={() => onCancelWaitlist(w.id)}
                    disabled={cancelingWaitlistId === w.id}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                    {cancelingWaitlistId === w.id ? "Saindo…" : "Sair da lista de espera"}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {tab === "next" ? "Nenhum agendamento futuro por aqui." : "Ainda não há histórico por aqui."}
            </p>
            {/* Por segurança a lista é deste aparelho (não do telefone): quem
                agendou em outro celular, ou antes dessa mudança, precisa saber
                que o horário não sumiu. */}
            {dicaAparelho && (
              <p className="text-xs text-muted-foreground/80 max-w-xs mx-auto">
                Aqui aparecem os horários marcados neste aparelho. Agendou em outro
                celular? Fale com o salão para conferir.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(tab === "history" ? filtered.slice(0, qtdHistorico) : filtered).map((a) => {
              const cancellable =
                (a.status === "pending" || a.status === "confirmed") &&
                new Date(a.starts_at).getTime() > agora;
              return (
                <div key={a.id} className="rounded-[var(--radius)] border border-border p-4">
                  <div className="flex justify-between items-start">
                    <p className="font-medium first-letter:uppercase">{formatDateLong(a.starts_at)}</p>
                    <span className="text-xs rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                      {statusLabel(a)}
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
                      onClick={() => onCancelAppt(a)}
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
            {tab === "history" && filtered.length > qtdHistorico && (
              <button
                type="button"
                onClick={() => setQtdHistorico((n) => n + HISTORICO_PAGINA)}
                className="w-full rounded-[var(--radius)] py-3 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                Ver mais ({filtered.length - qtdHistorico} {filtered.length - qtdHistorico === 1 ? "atendimento" : "atendimentos"})
              </button>
            )}
          </div>
        )}
      </Card>
    </MotionModal>
  );
}

function GalleryModal({
  photos,
  startIndex = 0,
  selectedIds,
  onToggle,
  onClose,
}: {
  photos: GalleryPhoto[];
  startIndex?: number;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(Math.min(Math.max(0, startIndex), photos.length - 1));
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const current = photos[idx];
  const isSelected = current ? selectedIds.includes(current.id) : false;
  const count = selectedIds.length;

  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  useEffect(() => {
    closeRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // A página por trás não rola enquanto a foto está aberta.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Miniatura da foto atual sempre à vista na fita.
  useEffect(() => {
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [idx]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    touchX.current = null;
  };

  return (
    // Fundo sólido: com 90% de opacidade a página aparecia por trás e
    // competia com a foto — que é a única coisa que importa aqui.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Trabalhos do salão — foto ${idx + 1} de ${photos.length}`}
      className="fixed inset-0 z-50 bg-[#0b0b0c] text-white flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* topo */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <span className="text-sm font-medium text-white/70 tabular-nums" aria-hidden>
          {idx + 1} de {photos.length}
        </span>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Fechar galeria"
          className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* foto */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-3 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.url}
          alt={current.caption ?? `Trabalho do salão, foto ${idx + 1}`}
          className="max-h-full max-w-full object-contain rounded-xl select-none"
          style={{ animation: "fadeIn 0.2s ease" }}
          draggable={false}
        />
        {/* Setas só a partir do tablet: no celular o gesto de arrastar resolve
            e as setas tampavam a borda da foto. */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Foto anterior"
              className="hidden sm:grid absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CaretLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Próxima foto"
              className="hidden sm:grid absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CaretRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Legenda + ação */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex flex-col items-center gap-2 text-center">
        {current.caption && (
          <p className="text-sm text-white/80 max-w-md line-clamp-2">{current.caption}</p>
        )}
        <button
          onClick={() => onToggle(current.id)}
          aria-pressed={isSelected}
          className={`inline-flex items-center gap-2 rounded-full h-11 px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
            isSelected ? "bg-white/15 text-white ring-1 ring-inset ring-white/50" : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          <Heart className="h-4 w-4" weight={isSelected ? "fill" : "regular"} />
          {isSelected ? "Escolhida como inspiração" : "Quero este estilo"}
        </button>
        <p className="text-xs text-white/55 max-w-xs">
          {isSelected
            ? "Toque de novo para tirar. O profissional vai ver esta foto no seu agendamento."
            : "Marque as fotos do que você quer fazer — o profissional vai ver no seu agendamento."}
        </p>
      </div>

      {/* miniaturas */}
      {photos.length > 1 && (
        <div ref={thumbsRef} className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3 shrink-0 sm:justify-center">
          {photos.map((p, i) => {
            const sel = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setIdx(i)}
                aria-label={`Ver foto ${i + 1}${sel ? " (escolhida)" : ""}`}
                aria-current={i === idx ? "true" : undefined}
                className={`relative shrink-0 h-16 w-14 rounded-lg overflow-hidden transition ${
                  i === idx ? "ring-2 ring-white opacity-100" : "opacity-50 hover:opacity-80"
                }`}
              >
                <NextImage src={p.url} alt="" fill sizes="56px" className="object-cover" />
                {sel && (
                  <span aria-hidden className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Heart className="h-3 w-3" weight="fill" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Volta pro agendamento com o que escolheu — sem caçar o X. */}
      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
        <button
          onClick={onClose}
          className="w-full max-w-md mx-auto flex items-center justify-center gap-2 h-12 rounded-full border border-white/20 text-sm font-semibold hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {count > 0
            ? `Continuar agendando · ${count} inspiraç${count === 1 ? "ão" : "ões"}`
            : "Voltar ao agendamento"}
        </button>
      </div>
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
        {/* Travado, diz o que falta — botão cinza mudo parece defeito. */}
        <Button className="flex-1" size="lg" onClick={onNext} disabled={!canNext}>
          {canNext
            ? "Continuar"
            : step === "services" ? "Escolha um serviço"
            : step === "professional" ? "Escolha quem vai te atender"
            : "Escolha um horário"}
          {canNext && <CaretRight aria-hidden className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function DateRuler({
  value,
  onChange,
  vagas,
}: {
  value: string;
  onChange: (v: string) => void;
  /** horários por dia; 0 = sem vaga (o dia aparece apagado, mas segue tocável para a lista de espera) */
  vagas: Record<string, number>;
}) {
  const days = useMemo(() => {
    return proximosDias(todayLocal(), 7).map((ds) => {
      const d = new Date(ds + "T12:00:00");
      const dow = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const longo = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
      return { ds, dow, day: d.getDate(), longo };
    });
  }, []);

  return (
    <div role="group" aria-label="Dia" className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
      {days.map((d, i) => {
        const on = d.ds === value;
        const semVaga = vagas[d.ds] === 0;
        return (
          <button
            key={d.ds}
            type="button"
            onClick={() => onChange(d.ds)}
            aria-pressed={on}
            aria-label={`${i === 0 ? "Hoje, " : ""}${d.longo}${semVaga ? ", sem horários livres" : ""}`}
            className={`shrink-0 w-14 rounded-[var(--radius)] border py-2.5 flex flex-col items-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              on
                ? "bg-primary text-primary-foreground border-primary"
                : semVaga
                  ? "border-dashed border-border bg-transparent text-muted-foreground"
                  : "border-border bg-card hover:border-foreground/25"
            }`}
          >
            <span className={`text-[11px] uppercase tracking-wide ${on ? "" : "opacity-80"}`}>{i === 0 ? "Hoje" : d.dow}</span>
            <span className={`text-lg font-semibold leading-none mt-1 ${semVaga && !on ? "line-through decoration-1 opacity-60" : ""}`}>{d.day}</span>
          </button>
        );
      })}
    </div>
  );
}

/** `n` dias a partir de `inicio` (YYYY-MM-DD, data local). */
function proximosDias(inicio: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somaDias(inicio, i));
}

function somaDias(ds: string, n: number): string {
  const d = new Date(ds + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDiaCurto(ds: string): string {
  return new Date(ds + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }).replace(".", "");
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/**
 * A grade em si mora em `@/components/TimeSlots`, dividida com o painel: o
 * mesmo salão via um layout aqui e um dropdown lá dentro. Este invólucro
 * existe só para manter o nome usado no passo do horário.
 */
function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (s: string) => void;
}) {
  // 9 por período (3 linhas de 3 no celular); `key` no pai zera o "ver mais" ao trocar de dia.
  return <TimeSlots slots={slots} selected={selected} onSelect={onSelect} limitPerGroup={9} />;
}
