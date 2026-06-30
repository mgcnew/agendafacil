import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfTodayBR, startOfTomorrowBR } from "@/lib/utils";
import { getDeepSeekClient, DEEPSEEK_MODEL } from "./deepseek";

/**
 * Resumo diário do "Gestor Zulan" no Dashboard.
 *
 * Princípio: o DeepSeek nunca calcula números — só narra, prioriza e dá tom
 * humano a sinais que o painel já computa de forma confiável (SQL). Isso evita
 * alucinação e mantém o custo previsível (1 chamada por salão por dia, cacheada
 * em `ai_dashboard_insights`).
 */

export type DashboardSignals = {
  firstName: string;
  salonName: string;
  apptsToday: number;
  revenueToday: number;
  reactivateCount: number;
  birthdaysToday: number;
  birthdaysSoon: number;
  pkgsExpiringSoon: number;
  productsLowCount: number;
};

export type InsightType =
  | "reactivation"
  | "birthday"
  | "package_expiring"
  | "revenue"
  | "low_stock"
  | "general";

export type Insight = {
  type: InsightType;
  title: string;
  detail: string;
  priority: "alta" | "media" | "baixa";
};

export type DashboardInsightsPayload = {
  insights: Insight[];
};

export type DashboardInsightsResult = DashboardInsightsPayload & {
  mode: "live" | "stub";
};

const TOOL_NAME = "report_insights";

function buildSystemPrompt(): string {
  return [
    "Você é o Gestor Zulan, a funcionária virtual que cuida do dia a dia do salão.",
    "Fale como uma excelente recepcionista: natural, calorosa, direta — nunca como um robô ou relatório técnico.",
    "Nunca use jargão de dados (ex.: 'detectei', 'métrica', 'taxa'). Prefira frases como 'percebi que...', 'consegui...'.",
    "Use SOMENTE os números fornecidos no contexto. Nunca invente clientes, valores ou eventos que não estejam nos dados.",
    "Toda sugestão precisa responder: aumenta faturamento, economiza tempo ou melhora a experiência do cliente?",
    "Gere no máximo 4 insights, ordenados por prioridade. Se os números forem todos baixos/zerados, é normal devolver poucos ou nenhum insight — não force conteúdo.",
    `Responda chamando a função ${TOOL_NAME}.`,
  ].join(" ");
}

function buildUserPrompt(signals: DashboardSignals): string {
  return `Dados de hoje no salão "${signals.salonName}" (dono: ${signals.firstName || "—"}):
- Agendamentos hoje: ${signals.apptsToday}
- Previsão de faturamento hoje: R$ ${signals.revenueToday.toFixed(2)}
- Clientes parados/com ritmo de retorno atrasado: ${signals.reactivateCount}
- Aniversariantes hoje: ${signals.birthdaysToday}
- Aniversariantes nos próximos dias: ${signals.birthdaysSoon}
- Pacotes de sessões vencendo em até 3 dias: ${signals.pkgsExpiringSoon}
- Produtos no estoque mínimo: ${signals.productsLowCount}

Escreva os insights mais relevantes para hoje.`;
}

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: TOOL_NAME,
    description: "Reporta o resumo do dia para o dono do salão.",
    parameters: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["reactivation", "birthday", "package_expiring", "revenue", "low_stock", "general"],
              },
              title: { type: "string", description: "Frase curta, até 60 caracteres." },
              detail: { type: "string", description: "1-2 frases explicando a oportunidade." },
              priority: { type: "string", enum: ["alta", "media", "baixa"] },
            },
            required: ["type", "title", "detail", "priority"],
          },
        },
      },
      required: ["insights"],
    },
  },
};

function stubPayload(signals: DashboardSignals): DashboardInsightsPayload {
  const insights: Insight[] = [];
  if (signals.reactivateCount > 0) {
    insights.push({
      type: "reactivation",
      title: `${signals.reactivateCount} cliente${signals.reactivateCount === 1 ? "" : "s"} pode${signals.reactivateCount === 1 ? "" : "m"} voltar`,
      detail: "Passaram do ritmo habitual de retorno — vale chamar no WhatsApp.",
      priority: "alta",
    });
  }
  if (signals.pkgsExpiringSoon > 0) {
    insights.push({
      type: "package_expiring",
      title: `${signals.pkgsExpiringSoon} pacote${signals.pkgsExpiringSoon === 1 ? "" : "s"} vencendo`,
      detail: "Sessões compradas perto do prazo final de uso.",
      priority: "media",
    });
  }
  if (signals.birthdaysToday > 0) {
    insights.push({
      type: "birthday",
      title: `${signals.birthdaysToday} aniversariante${signals.birthdaysToday === 1 ? "" : "s"} hoje`,
      detail: "Um parabéns no WhatsApp fortalece o relacionamento.",
      priority: "media",
    });
  }
  if (signals.productsLowCount > 0) {
    insights.push({
      type: "low_stock",
      title: `${signals.productsLowCount} produto${signals.productsLowCount === 1 ? "" : "s"} no estoque mínimo`,
      detail: "Vale repor antes que falte durante um atendimento.",
      priority: "media",
    });
  }
  return { insights };
}

async function generateLive(signals: DashboardSignals): Promise<DashboardInsightsPayload | null> {
  const client = getDeepSeekClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(signals) },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
      temperature: 0.4,
      max_tokens: 800,
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== "function" || call.function.name !== TOOL_NAME) return null;

    const parsed = JSON.parse(call.function.arguments) as DashboardInsightsPayload;
    if (!Array.isArray(parsed.insights)) return null;
    return { insights: parsed.insights.slice(0, 4) };
  } catch {
    return null; // qualquer falha (rede, parse, etc.) cai no stub — nunca quebra o Dashboard
  }
}

async function generateAndCache(
  supabase: SupabaseClient,
  salonId: string,
  date: string,
  signals: DashboardSignals,
): Promise<DashboardInsightsResult> {
  const live = await generateLive(signals);
  const payload = live ?? stubPayload(signals);
  const mode: "live" | "stub" = live ? "live" : "stub";

  await supabase
    .from("ai_dashboard_insights")
    .upsert(
      { salon_id: salonId, date, payload, model: live ? DEEPSEEK_MODEL : null },
      { onConflict: "salon_id,date" },
    );
  // Erro de upsert (ex.: migração não aplicada ainda) é ignorado de propósito —
  // o resumo já foi calculado e é devolvido mesmo sem cache persistido.

  return { ...payload, mode };
}

/**
 * Busca o resumo do dia em cache; se não existir, gera (live se houver
 * DEEPSEEK_API_KEY, senão stub determinístico) e tenta cachear para o resto
 * do dia. Nunca lança — na pior hipótese devolve o stub.
 */
export async function getOrGenerateDashboardInsights(
  supabase: SupabaseClient,
  salonId: string,
  signals: DashboardSignals,
): Promise<DashboardInsightsResult> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: cached } = await supabase
    .from("ai_dashboard_insights")
    .select("payload, model")
    .eq("salon_id", salonId)
    .eq("date", today)
    .maybeSingle();

  if (cached?.payload) {
    const payload = cached.payload as unknown as DashboardInsightsPayload;
    return { ...payload, mode: cached.model ? "live" : "stub" };
  }

  return generateAndCache(supabase, salonId, today, signals);
}

/** Ignora o cache do dia e força uma nova geração (botão "Atualizar"). */
export async function refreshDashboardInsights(
  supabase: SupabaseClient,
  salonId: string,
  signals: DashboardSignals,
): Promise<DashboardInsightsResult> {
  const today = new Date().toISOString().slice(0, 10);
  return generateAndCache(supabase, salonId, today, signals);
}

/**
 * Recalcula os sinais do zero (usado pelo botão "Atualizar", que não tem
 * acesso aos dados já carregados pela página do Dashboard).
 */
export async function computeGestorSignals(
  supabase: SupabaseClient,
  salonId: string,
  opts: { profileId: string; displayName: string; salonName: string },
): Promise<DashboardSignals> {
  const startDay = startOfTodayBR();
  const endDay = startOfTomorrowBR();

  const [{ data: todayAppts }, { data: profile }, { data: reactRaw }, { data: bdayRaw }, { data: pkgsRaw }, { data: productsRaw }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("status, total_price")
        .eq("salon_id", salonId)
        .gte("starts_at", startDay)
        .lt("starts_at", endDay),
      supabase.from("profiles").select("full_name").eq("id", opts.profileId).maybeSingle(),
      supabase.rpc("report_reactivation" as never, { p_salon: salonId, p_min_days: 14 } as never),
      supabase.rpc("upcoming_birthdays" as never, { p_salon: salonId, p_days: 31 } as never),
      supabase.from("client_packages").select("expires_at").eq("salon_id", salonId).eq("status", "active"),
      supabase.from("products").select("quantity, min_quantity").eq("salon_id", salonId).eq("is_active", true),
    ]);

  const appts = (todayAppts ?? []) as { status: string; total_price: number }[];
  const revenueToday = appts
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((sum, a) => sum + Number(a.total_price), 0);

  const reactArr = reactRaw as unknown[] | null;
  const reactivateCount = Array.isArray(reactArr) ? reactArr.length : 0;

  const birthdays = (Array.isArray(bdayRaw) ? bdayRaw : []) as { days_until: number }[];
  const birthdaysToday = birthdays.filter((b) => b.days_until === 0).length;

  const pkgs = (pkgsRaw ?? []) as { expires_at: string }[];
  const pkgsExpiringSoon = pkgs.filter((p) => {
    const dleft = Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / 86400000);
    return dleft >= 0 && dleft <= 3;
  }).length;

  const products = (productsRaw ?? []) as { quantity: number; min_quantity: number }[];
  const productsLowCount = products.filter(
    (p) => Number(p.quantity) <= Number(p.min_quantity) && Number(p.min_quantity) > 0,
  ).length;

  const fullName = (profile?.full_name ?? opts.displayName ?? "").trim();

  return {
    firstName: fullName ? fullName.split(" ")[0] : "",
    salonName: opts.salonName,
    apptsToday: appts.length,
    revenueToday,
    reactivateCount,
    birthdaysToday,
    birthdaysSoon: Math.max(0, birthdays.length - birthdaysToday),
    pkgsExpiringSoon,
    productsLowCount,
  };
}
