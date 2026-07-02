import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeepSeekClient, DEEPSEEK_MODEL } from "./deepseek";
import type { Signal, GestorContext } from "@/lib/signals/types";

/**
 * Resumo diário do "Gestor Zulan" no Dashboard.
 *
 * Princípio: o DeepSeek nunca calcula números — só narra, prioriza e dá tom
 * humano aos sinais que o painel já computa de forma confiável (ver
 * `@/lib/signals`). Isso evita alucinação e mantém o custo previsível (1
 * chamada por salão por dia, cacheada em `ai_dashboard_insights`; salão sem
 * nenhum sinal nem chega a chamar a IA).
 */

export type InsightType =
  | "reactivation"
  | "birthday"
  | "package_expiring"
  | "package_dormant"
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
    "Você é o Gestor Zulan, o gerente de confiança que cuida do dia a dia do salão e conversa com o dono.",
    "Fale como um ótimo gerente: natural, caloroso, direto — nunca como um robô ou relatório técnico.",
    "Nunca use jargão de dados (ex.: 'detectei', 'métrica', 'taxa'). Prefira frases como 'percebi que...', 'reparei aqui...'.",
    "Use SOMENTE os números fornecidos no contexto. Nunca invente clientes, valores ou eventos que não estejam nos dados.",
    "Ao citar qualquer número (dias para vencer, quantidade de clientes, etc.), use exatamente o número informado no contexto — nunca estime ou arredonde por conta própria.",
    "Toda sugestão precisa responder: aumenta faturamento, economiza tempo ou melhora a experiência do cliente?",
    "Gere no máximo 4 insights, ordenados por prioridade.",
    `Responda chamando a função ${TOOL_NAME}.`,
  ].join(" ");
}

function buildUserPrompt(context: GestorContext, signals: Signal[]): string {
  const factLines = signals.map((s) => `- ${s.fact}`).join("\n");
  return `Dados de hoje no salão "${context.salonName}" (dono: ${context.firstName || "—"}):
- Agendamentos hoje: ${context.apptsToday}
- Previsão de faturamento hoje: R$ ${context.revenueToday.toFixed(2)}

Sinais que merecem atenção (já calculados — cite os números exatamente como estão):
${factLines}

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
                enum: ["reactivation", "birthday", "package_expiring", "package_dormant", "revenue", "low_stock", "general"],
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

// Mapa determinístico sinal → insight (fallback quando não há IA disponível).
const STUB: Record<Signal["key"], { type: InsightType; title: (c: number) => string; priority: Insight["priority"] }> = {
  reactivation: {
    type: "reactivation",
    title: (c) => `${c} cliente${c === 1 ? "" : "s"} pode${c === 1 ? "" : "m"} voltar`,
    priority: "alta",
  },
  birthday_today: {
    type: "birthday",
    title: (c) => `${c} aniversariante${c === 1 ? "" : "s"} hoje`,
    priority: "media",
  },
  package_expiring: {
    type: "package_expiring",
    title: (c) => `${c} pacote${c === 1 ? "" : "s"} vencendo`,
    priority: "media",
  },
  package_dormant: {
    type: "package_dormant",
    title: (c) => `${c} pacote${c === 1 ? "" : "s"} comprado${c === 1 ? "" : "s"} e sem uso`,
    priority: "media",
  },
  low_stock: {
    type: "low_stock",
    title: (c) => `${c} produto${c === 1 ? "" : "s"} no estoque mínimo`,
    priority: "media",
  },
};

function stubPayload(signals: Signal[]): DashboardInsightsPayload {
  const insights: Insight[] = signals.slice(0, 4).map((s) => {
    const meta = STUB[s.key];
    return { type: meta.type, title: meta.title(s.count), detail: s.fact, priority: meta.priority };
  });
  return { insights };
}

async function generateLive(context: GestorContext, signals: Signal[]): Promise<DashboardInsightsPayload | null> {
  const client = getDeepSeekClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(context, signals) },
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
  context: GestorContext,
  signals: Signal[],
): Promise<DashboardInsightsResult> {
  // Sem sinais = nada a avisar: devolve vazio sem gastar chamada de IA.
  if (signals.length === 0) {
    await supabase
      .from("ai_dashboard_insights")
      .upsert({ salon_id: salonId, date, payload: { insights: [] }, model: null }, { onConflict: "salon_id,date" });
    return { insights: [], mode: "stub" };
  }

  const live = await generateLive(context, signals);
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
 * DEEPSEEK_API_KEY e houver sinais, senão stub/vazio) e tenta cachear para o
 * resto do dia. Nunca lança — na pior hipótese devolve o stub.
 */
export async function getOrGenerateDashboardInsights(
  supabase: SupabaseClient,
  salonId: string,
  context: GestorContext,
  signals: Signal[],
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

  return generateAndCache(supabase, salonId, today, context, signals);
}

/** Ignora o cache do dia e força uma nova geração (botão "Atualizar"). */
export async function refreshDashboardInsights(
  supabase: SupabaseClient,
  salonId: string,
  context: GestorContext,
  signals: Signal[],
): Promise<DashboardInsightsResult> {
  const today = new Date().toISOString().slice(0, 10);
  return generateAndCache(supabase, salonId, today, context, signals);
}
