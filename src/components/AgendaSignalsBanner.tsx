import Link from "next/link";
import { LateNudgeButton } from "./LateNudgeButton";
import { formatBRL } from "@/lib/utils";
import {
  ArrowSquareOut,
  CalendarDots,
  CalendarX,
  CaretDown,
  ClockCountdown,
  House,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

/** "hoje" · "amanhã" · "05/08" — a data do pedido, curta o bastante pra caber. */
function diaCurto(iso: string): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(d) - dia(new Date())) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Sinais "de agora" da Agenda (cancelamento, atraso, horário livre) — fonte
 * compartilhada entre o banner da própria Agenda (cálculo ao vivo, client-side,
 * com realtime) e o bloco equivalente no Dashboard (cálculo server-side, sem
 * IA). Os dois precisam concordar nos mesmos números; por isso moram no mesmo
 * lugar em vez de duas implementações divergentes.
 */
export type LateClient = { id: string; name: string; phone: string | null; time: string };
/** Pedido de domicílio ainda sem quilometragem — cliente esperando o valor. */
export type HomeRequest = { id: string; name: string; time: string; date: string };
export type TodaySignals = {
  cancelled: number;
  /** Lista (não só contagem) — cada atraso vira uma sugestão acionável de lembrete. */
  lateClients: LateClient[];
  /** Pedidos de domicílio aguardando o valor do deslocamento. */
  homeRequests?: HomeRequest[];
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

/**
 * Atalho pra lista de espera. Dentro da Agenda o bloco já está na tela, então
 * rola até ele; no Dashboard não existe, e aí vira link.
 */
function WaitlistAction({ slug, onShowWaitlist }: { slug: string; onShowWaitlist?: () => void }) {
  const classe =
    "mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline";
  return onShowWaitlist ? (
    <button type="button" onClick={onShowWaitlist} className={classe}>
      Ver quem está esperando <CaretDown className="h-3 w-3" />
    </button>
  ) : (
    <Link href={`/painel/${slug}/agenda`} className={classe}>
      Ver quem está esperando <ArrowSquareOut className="h-3 w-3" />
    </Link>
  );
}

/**
 * Banner de sinais do dia — regra direta, sem IA (v1/v2 do roadmap, ver
 * docs/produto/zulan-2.0-roadmap-ia.md). Fala como alguém da equipe avisando
 * o dono, sempre propondo uma ação de 1 clique (nunca só o número cru) — o
 * clique do dono É a autorização; nada é enviado sozinho.
 * Some por completo se não houver nada relevante.
 */
export function AgendaSignalsBanner({
  signals,
  slug,
  waiting = 0,
  onShowWaitlist,
}: {
  signals: TodaySignals | null;
  slug: string;
  /** Quantas pessoas pediram pra ser chamadas se abrir vaga (hoje em diante).
   *  Prop separada porque vem de outra consulta, viva, e não do mesmo
   *  cálculo dos sinais do dia. */
  waiting?: number;
  /** Na Agenda, leva até o bloco da lista de espera. Ausente no Dashboard, que
   *  não tem o bloco — lá o botão vira link pra Agenda. */
  onShowWaitlist?: () => void;
}) {
  if (!signals) return null;
  const { cancelled, lateClients, emptySlots, estimatedRevenue } = signals;
  const homeRequests = signals.homeRequests ?? [];

  // Horário livre sozinho NÃO é aviso: é o estado normal de quase todo dia, e
  // um alerta que aparece sempre vira mobília — a pessoa para de ler. Só vira
  // notícia quando existe alguém esperando vaga, porque aí há o que fazer.
  const mostrarVazios = emptySlots > 0 && waiting > 0;
  if (cancelled === 0 && lateClients.length === 0 && !mostrarVazios && homeRequests.length === 0)
    return null;

  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkle className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold">De olho na agenda de hoje</p>
      </div>

      <div className="space-y-2">
        {/* Primeiro de todos de propósito: nos outros avisos o dia continua
            andando sozinho. Aqui tem alguém parada esperando um valor que só
            você pode dar — e sem ele o agendamento não fecha. */}
        {homeRequests.length > 0 && (
          <div className="rounded-[var(--radius)] border border-primary/40 bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <House className="h-4 w-4 shrink-0 text-primary" weight="fill" />
              {homeRequests.length === 1 ? (
                <span>
                  <b>{homeRequests[0].name.split(" ")[0]}</b> pediu atendimento em
                  casa e está esperando o valor do deslocamento.
                </span>
              ) : (
                <span>
                  <b>{homeRequests.length} clientes</b> pediram atendimento em casa
                  e estão esperando o valor do deslocamento.
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {homeRequests.map((h) => `${h.name.split(" ")[0]} · ${diaCurto(h.date)} ${h.time}`).join(" · ")}
            </p>
            <Link
              href={`/painel/${slug}/agenda`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Definir o valor na Agenda <ArrowSquareOut className="h-3 w-3" />
            </Link>
          </div>
        )}

        {lateClients.length > 0 && (
          <div className="rounded-[var(--radius)] border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <ClockCountdown className="h-4 w-4 shrink-0 text-amber-600" />
              {lateClients.length === 1
                ? `${lateClients[0].name.split(" ")[0]} ainda não chegou pro horário das ${lateClients[0].time}.`
                : `${lateClients.length} clientes ainda não chegaram pro horário deles.`}{" "}
              Quer que eu avise?
            </p>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              {lateClients.map((c) => (
                <LateNudgeButton key={c.id} client={c} />
              ))}
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
              {waiting > 0
                ? waiting === 1
                  ? "Tem 1 pessoa esperando vaga."
                  : `Tem ${waiting} pessoas esperando vaga.`
                : "Posso te mostrar quem pode vir no lugar."}
            </p>
            {/* Quem está na lista de espera PEDIU pra ser chamado. Mandar pro
                Recuperar nessa hora era a porta errada: lá estão os que
                sumiram, que não pediram nada. Só cai no Recuperar quando não
                há ninguém esperando. */}
            {waiting > 0 ? (
              <WaitlistAction slug={slug} onShowWaitlist={onShowWaitlist} />
            ) : (
              <Link
                href={`/painel/${slug}/recuperar`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Ver clientes pra chamar <ArrowSquareOut className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {mostrarVazios && (
          <div className="rounded-[var(--radius)] border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <CalendarDots className="h-4 w-4 shrink-0 text-primary" />
              Ainda {emptySlots === 1 ? "tem 1 horário livre" : `tem ${emptySlots} horários livres`} hoje
              {estimatedRevenue !== null ? ` — algo em torno de ${formatBRL(estimatedRevenue)} se preencher tudo.` : "."}{" "}
              {waiting === 1 ? "E tem 1 pessoa na lista de espera." : `E tem ${waiting} pessoas na lista de espera.`}
            </p>
            <WaitlistAction slug={slug} onShowWaitlist={onShowWaitlist} />
          </div>
        )}
      </div>
    </div>
  );
}
