import Link from "next/link";
import { formatBRL } from "@/lib/utils";
import {
  ArrowSquareOut,
  CalendarDots,
  CalendarX,
  ChatCircle,
  ClockCountdown,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Sinais "de agora" da Agenda (cancelamento, atraso, horário livre) — fonte
 * compartilhada entre o banner da própria Agenda (cálculo ao vivo, client-side,
 * com realtime) e o bloco equivalente no Dashboard (cálculo server-side, sem
 * IA). Os dois precisam concordar nos mesmos números; por isso moram no mesmo
 * lugar em vez de duas implementações divergentes.
 */
export type LateClient = { id: string; name: string; phone: string | null; time: string };
export type TodaySignals = {
  cancelled: number;
  /** Lista (não só contagem) — cada atraso vira uma sugestão acionável de lembrete. */
  lateClients: LateClient[];
  emptySlots: number;
  /** Estimativa de faturamento dos horários vazios, com base no histórico (v2). null = sem amostra suficiente/não calculado. */
  estimatedRevenue: number | null;
};

/** Normaliza telefone BR para o formato do wa.me (55 + DDD + número, só dígitos). */
export function waPhone(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

/** Monta o link do WhatsApp pra cobrar gentilmente um cliente atrasado. */
function lateReminderUrl(client: LateClient) {
  const first = client.name.split(" ")[0];
  const msg =
    `Oi${first && first !== "Cliente" ? ` ${first}` : ""}! Tudo bem? ` +
    `Você tinha um horário marcado aqui hoje às ${client.time} 💇 ` +
    `Ainda vem ou prefere remarcar?`;
  const phone = waPhone(client.phone);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;
}

/**
 * Banner de sinais do dia — regra direta, sem IA (v1/v2 do roadmap, ver
 * docs/produto/zulan-2.0-roadmap-ia.md). Fala como alguém da equipe avisando
 * o dono, sempre propondo uma ação de 1 clique (nunca só o número cru) — o
 * clique do dono É a autorização; nada é enviado sozinho.
 * Some por completo se não houver nada relevante.
 */
export function AgendaSignalsBanner({ signals, slug }: { signals: TodaySignals | null; slug: string }) {
  if (!signals) return null;
  const { cancelled, lateClients, emptySlots, estimatedRevenue } = signals;
  if (cancelled === 0 && lateClients.length === 0 && emptySlots === 0) return null;

  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkle className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold">De olho na agenda de hoje</p>
      </div>

      <div className="space-y-2">
        {lateClients.length > 0 && (
          <div className="rounded-[var(--radius)] border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <ClockCountdown className="h-4 w-4 shrink-0 text-amber-600" />
              {lateClients.length === 1
                ? `${lateClients[0].name.split(" ")[0]} ainda não chegou pro horário das ${lateClients[0].time}.`
                : `${lateClients.length} clientes ainda não chegaram pro horário deles.`}{" "}
              Quer que eu avise?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lateClients.map((c) => {
                const url = lateReminderUrl(c);
                return url ? (
                  <a
                    key={c.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/15 transition"
                  >
                    <ChatCircle className="h-3.5 w-3.5" /> Lembrar {c.name.split(" ")[0]} ({c.time})
                  </a>
                ) : (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {c.name.split(" ")[0]} ({c.time}) — sem WhatsApp cadastrado
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {cancelled > 0 && (
          <div className="rounded-[var(--radius)] border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <CalendarX className="h-4 w-4 shrink-0 text-red-600" />
              {cancelled === 1
                ? "Um horário cancelou hoje e ficou livre."
                : `${cancelled} horários cancelaram hoje e ficaram livres.`}{" "}
              Posso te mostrar quem pode vir no lugar.
            </p>
            <Link
              href={`/painel/${slug}/recuperar`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Ver clientes pra chamar <ArrowSquareOut className="h-3 w-3" />
            </Link>
          </div>
        )}

        {emptySlots > 0 && (
          <div className="rounded-[var(--radius)] border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <CalendarDots className="h-4 w-4 shrink-0 text-primary" />
              Ainda {emptySlots === 1 ? "tem 1 horário livre" : `tem ${emptySlots} horários livres`} hoje
              {estimatedRevenue !== null ? ` — algo em torno de ${formatBRL(estimatedRevenue)} se preencher tudo.` : "."}{" "}
              Quer que eu sugira algum cliente parado pra esses horários?
            </p>
            <Link
              href={`/painel/${slug}/recuperar`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Ver quem chamar <ArrowSquareOut className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
