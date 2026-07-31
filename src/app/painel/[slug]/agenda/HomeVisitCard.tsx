"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { ArrowSquareOut, CircleNotch, House, MapPin, PencilSimple, Warning } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/utils";
import { homeServiceFee, type Tarifa } from "@/lib/homeService";

type Conflito = { id: string; client_name: string; starts_at: string };

export type HomeVisitConfig = {
  tarifa: Tarifa;
  maxKm: number | null;
  /** Endereço do salão, para virar a origem do trajeto no Maps. */
  origem: string | null;
};

/**
 * Atendimento em domicílio na ficha do agendamento.
 *
 * Aqui é onde a profissional fecha o valor, e é o único passo manual do
 * recurso inteiro — uma vez por cliente, nunca mais. Ela abre o Maps pelo
 * atalho (origem e destino já preenchidos, rota real, sem API paga), lê o km e
 * digita. O valor aparece enquanto ela digita, então confirmar nunca é no
 * escuro.
 *
 * O km fica guardado na ficha da cliente: da próxima vez a página pública já
 * mostra o valor fechado e este card nem aparece.
 */
export function HomeVisitCard({
  appointmentId,
  endereco,
  km,
  taxa,
  minutos,
  config,
  podeEditar,
  onSalvo,
}: {
  appointmentId: string;
  endereco: string | null;
  km: number | null;
  taxa: number;
  /** Tempo de deslocamento de cada lado, já informado antes. */
  minutos: number | null;
  config: HomeVisitConfig;
  podeEditar: boolean;
  onSalvo: (r: { km: number; taxa: number; minutos: number | null }) => void;
}) {
  const [editando, setEditando] = useState(km == null);
  const [valor, setValor] = useState(km == null ? "" : String(km).replace(".", ","));
  const [min, setMin] = useState(minutos == null ? "" : String(minutos));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflitos, setConflitos] = useState<Conflito[]>([]);

  const kmDigitado = Number(valor.replace(",", ".").trim());
  const kmValido = valor.trim() !== "" && Number.isFinite(kmDigitado) && kmDigitado >= 0;
  const previa = kmValido ? homeServiceFee(kmDigitado, config.tarifa) : null;
  const foraDaArea = config.maxKm != null && kmValido && kmDigitado > config.maxKm;

  const minDigitado = Number(min.replace(",", ".").trim());
  const minValido = min.trim() === "" || (Number.isFinite(minDigitado) && minDigitado >= 0 && minDigitado <= 480);
  const minutosParaSalvar = min.trim() === "" ? null : Math.round(minDigitado);

  // Pergunta ao banco quem esbarra na ida ou na volta. Só faz sentido enquanto
  // ela está decidindo — é o último momento em que dá pra propor outro horário
  // à cliente em vez de descobrir o problema no dia.
  useEffect(() => {
    if (!editando || minutosParaSalvar == null || minutosParaSalvar <= 0) return;
    let vivo = true;
    const id = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("home_travel_conflicts" as never, {
        p_appointment: appointmentId,
        p_minutes: minutosParaSalvar,
      } as never);
      if (vivo) setConflitos((data as Conflito[] | null) ?? []);
    }, 350);
    return () => { vivo = false; clearTimeout(id); };
  }, [editando, minutosParaSalvar, appointmentId]);

  // Derivado em vez de limpo por efeito: sem tempo informado não há janela de
  // deslocamento, então não há conflito a mostrar — e zerar isso no corpo do
  // efeito seria um render em cascata à toa.
  const conflitosVisiveis =
    minutosParaSalvar != null && minutosParaSalvar > 0 ? conflitos : [];

  const mapsUrl =
    endereco && config.origem
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(config.origem)}&destination=${encodeURIComponent(endereco)}&travelmode=driving`
      : endereco
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`
      : null;

  async function salvar() {
    if (!kmValido) return;
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_appointment_travel" as never, {
      p_appointment: appointmentId,
      p_km: kmDigitado,
      p_minutes: minutosParaSalvar,
    } as never);
    setSalvando(false);
    if (error) {
      setErro(
        error.message.includes("already_finalized")
          ? "Este atendimento já foi cobrado no caixa. Estorne antes de mudar o valor."
          : error.message.includes("forbidden")
          ? "Você não tem permissão para alterar agendamentos."
          : "Não foi possível salvar. Tente novamente.",
      );
      return;
    }
    const r = data as unknown as { travel_km: number; travel_fee: number } | null;
    setEditando(false);
    onSalvo({
      km: Number(r?.travel_km ?? kmDigitado),
      taxa: Number(r?.travel_fee ?? previa ?? 0),
      minutos: minutosParaSalvar,
    });
  }

  return (
    <div className="rounded-[var(--radius)] border border-primary/30 bg-primary/[0.04] p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <House className="h-3.5 w-3.5" /> Atendimento em domicílio
      </p>

      {endereco && (
        <p className="mt-2 flex items-start gap-1.5 text-sm">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{endereco}</span>
        </p>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowSquareOut className="h-3.5 w-3.5" />
          {config.origem ? "Ver trajeto no Maps" : "Ver endereço no Maps"}
        </a>
      )}

      {editando ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Abra o Maps e traga os dois números da mesma viagem: a distância
            define o valor, o tempo reserva a ida e a volta na sua agenda.
          </p>
          <div className="flex items-end gap-2">
            <div className="w-28">
              <label htmlFor="hv-km" className="text-xs text-muted-foreground">
                Distância (km)
              </label>
              <Input
                id="hv-km"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="4"
                autoFocus
              />
            </div>
            {/* Não é dado novo: a MESMA tela do Maps que dá o km dá o tempo. */}
            <div className="w-32">
              <label htmlFor="hv-min" className="text-xs text-muted-foreground">
                Ida/volta (min)
              </label>
              <Input
                id="hv-min"
                inputMode="numeric"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="opcional"
              />
            </div>
            {/* O valor aparece enquanto ela digita: confirmar nunca é no escuro. */}
            <div className="flex-1 pb-2">
              {previa != null ? (
                <p className="text-sm">
                  Taxa: <b className="text-primary">{formatBRL(previa)}</b>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Digite a distância</p>
              )}
            </div>
          </div>

          {!minValido && (
            <p className="text-xs text-red-600">O tempo precisa ser em minutos, até 8 horas.</p>
          )}

          {minutosParaSalvar != null && minutosParaSalvar > 0 && (
            <p className="text-xs text-muted-foreground">
              Vou bloquear {minutosParaSalvar} min antes e {minutosParaSalvar} min
              depois — ninguém consegue marcar em cima da sua saída.
            </p>
          )}

          {/* Avisa AGORA, que é o único momento em que ainda dá pra propor
              outro horário à cliente em vez de descobrir no dia. */}
          {conflitosVisiveis.length > 0 && (
            <div className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="flex items-start gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Com {minutosParaSalvar} min de deslocamento você não chega a tempo
                  de{" "}
                  <b>
                    {conflitosVisiveis
                      .map(
                        (c) =>
                          `${c.client_name.split(" ")[0]} às ${new Date(c.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`,
                      )
                      .join(", ")}
                  </b>
                  . Dá pra confirmar assim mesmo, mas o dia fica apertado.
                </span>
              </p>
            </div>
          )}

          {foraDaArea && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Acima do seu limite de {config.maxKm?.toLocaleString("pt-BR")} km. Dá
              pra confirmar mesmo assim se você quiser ir.
            </p>
          )}
          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <Button size="sm" onClick={salvar} disabled={!kmValido || !minValido || salvando} className="w-full">
            {salvando && <CircleNotch className="h-4 w-4 animate-spin" />}
            {km == null ? "Confirmar e avisar a cliente" : "Salvar novo valor"}
          </Button>
          {km == null && (
            <p className="text-[11px] text-muted-foreground">
              O agendamento passa a confirmado e a cliente recebe o valor no
              WhatsApp.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <span className="text-sm">
            {km?.toLocaleString("pt-BR")} km ·{" "}
            <b className="text-primary">{formatBRL(taxa)}</b>
            {minutos != null && minutos > 0 && (
              <span className="text-xs text-muted-foreground">
                {" "}· {minutos} min de cada lado reservados
              </span>
            )}
          </span>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <PencilSimple className="h-3.5 w-3.5" /> Corrigir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
