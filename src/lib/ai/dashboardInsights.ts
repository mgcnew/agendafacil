import type { SupabaseClient } from "@supabase/supabase-js";
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
};

export type InsightType =
  | "reactivation"
  | "birthday"
  | "package_expiring"
  | "revenue"
  | "general";

export type Insight = {
  type: InsightType;
  title: string;
  detail: string;
  priority: "alta" | "media" | "baixa";
};

export type DashboardInsightsPayload = {
  greeting: string;
  insights: Insight[];
};

export type DashboardInsightsResult = DashboardInsightsPayload & {
  mode: "live" | "stub";
};

const TOOL_NAME = "report_insights";

function buildSystemPrompt(): string {
  return [
    "Você é o Gestor Zulan, a funcionária virtual que abre o dia do dono do salão.",
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

Escreva uma saudação curta (1 frase) e os insights mais relevantes para hoje.`;
}

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: TOOL_NAME,
    description: "Reporta o resumo do dia para o dono do salão.",
    parameters: {
      type: "object",
      properties: {
        greeting: {
          type: "string",
          description: "Saudação curta e pessoal, 1 frase, tom de recepcionista.",
        },
        insights: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["reactivation", "birthday", "package_expiring", "revenue", "general"],
              },
              title: { type: "string", description: "Frase curta, até 60 caracteres." },
              detail: { type: "string", description: "1-2 frases explicando a oportunidade." },
              priority: { type: "string", enum: ["alta", "media", "baixa"] },
            },
            required: ["type", "title", "detail", "priority"],
          },
        },
      },
      required: ["greeting", "insights"],
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
  return {
    greeting: signals.firstName ? `Bom dia, ${signals.firstName}.` : "Bom dia.",
    insights,
  };
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
    if (!parsed.greeting || !Array.isArray(parsed.insights)) return null;
    return { greeting: parsed.greeting, insights: parsed.insights.slice(0, 4) };
  } catch {
    return null; // qualquer falha (rede, parse, etc.) cai no stub — nunca quebra o Dashboard
  }
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

  const live = await generateLive(signals);
  const payload = live ?? stubPayload(signals);
  const mode: "live" | "stub" = live ? "live" : "stub";

  await supabase
    .from("ai_dashboard_insights")
    .upsert(
      { salon_id: salonId, date: today, payload, model: live ? DEEPSEEK_MODEL : null },
      { onConflict: "salon_id,date" },
    );
  // Erro de upsert (ex.: migração não aplicada ainda) é ignorado de propósito —
  // o resumo já foi calculado e é devolvido mesmo sem cache persistido.

  return { ...payload, mode };
}
