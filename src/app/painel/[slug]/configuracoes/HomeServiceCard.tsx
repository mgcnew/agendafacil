"use client";

import Link from "next/link";
import { Card, Input, Label } from "@/components/ui";
import { House, Info } from "@phosphor-icons/react/dist/ssr";
import { formatBRL } from "@/lib/utils";
import { homeServiceFee } from "@/lib/homeService";

export type HomeServiceState = {
  enabled: boolean;
  firstKmFee: string;
  extraKmFee: string;
  maxKm: string;
  terms: string;
};

const CONDICOES_PADRAO =
  "Preciso de uma mesa firme e uma tomada por perto.\n" +
  "Estacionamento por conta da cliente, quando houver cobrança no local.\n" +
  "Se precisar desmarcar, me avise com antecedência.";

/**
 * Atendimento em domicílio — a tarifa e as condições.
 *
 * Fica nas regras de agendamento porque é isso que é: uma regra de como a
 * cliente pode marcar. A quilometragem de cada cliente NÃO se configura aqui —
 * ela é medida uma vez, no momento de confirmar o primeiro pedido daquela
 * pessoa, e vale para sempre. Aqui só mora o preço do km.
 */
export function HomeServiceCard({
  value,
  onChange,
  canEdit,
  slug,
}: {
  value: HomeServiceState;
  onChange: (v: HomeServiceState) => void;
  canEdit: boolean;
  slug: string;
}) {
  const set = <K extends keyof HomeServiceState>(k: K, v: HomeServiceState[K]) =>
    onChange({ ...value, [k]: v });

  const tarifa = {
    firstKmFee: Number(value.firstKmFee.replace(",", ".")) || 0,
    extraKmFee: Number(value.extraKmFee.replace(",", ".")) || 0,
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => canEdit && set("enabled", !value.enabled)}
          disabled={!canEdit}
          aria-pressed={value.enabled}
          aria-label="Atender em domicílio"
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 mt-0.5 ${
            value.enabled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              value.enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
        <div className="min-w-0">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <House className="h-5 w-5 text-primary" /> Atendimento em domicílio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Para a cliente que não consegue vir até você — pós-parto, sem
            transporte, cuidando de alguém. Ela pede pela sua página e você
            confirma.
          </p>
        </div>
      </div>

      {value.enabled && (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          <div>
            <p className="text-sm font-medium">Taxa de deslocamento</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="hs-first">Primeiro km</Label>
                <Input
                  id="hs-first"
                  inputMode="decimal"
                  value={value.firstKmFee}
                  onChange={(e) => set("firstKmFee", e.target.value)}
                  disabled={!canEdit}
                  placeholder="5,00"
                />
              </div>
              <div>
                <Label htmlFor="hs-extra">Cada km a mais</Label>
                <Input
                  id="hs-extra"
                  inputMode="decimal"
                  value={value.extraKmFee}
                  onChange={(e) => set("extraKmFee", e.target.value)}
                  disabled={!canEdit}
                  placeholder="2,00"
                />
              </div>
              <div>
                <Label htmlFor="hs-max">Atende até (km)</Label>
                <Input
                  id="hs-max"
                  inputMode="decimal"
                  value={value.maxKm}
                  onChange={(e) => set("maxKm", e.target.value)}
                  disabled={!canEdit}
                  placeholder="opcional"
                />
              </div>
            </div>

            {/* A tarifa sozinha é abstrata. Ver o que ela produz é o que faz a
                pessoa perceber que R$ 2/km vira R$ 25 no bairro de longe. */}
            <div className="mt-3 rounded-[var(--radius)] bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Com essa tarifa, a cliente paga
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {[2, 5, 10].map((km) => (
                  <span key={km}>
                    <b className="tabular-nums">{km} km</b>{" "}
                    <span className="text-muted-foreground">
                      {formatBRL(homeServiceFee(km, tarifa))}
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                A distância é arredondada pra cima: 4,2 km cobra como 5 km.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="hs-terms">Condições do atendimento</Label>
            <textarea
              id="hs-terms"
              rows={4}
              value={value.terms}
              onChange={(e) => set("terms", e.target.value)}
              disabled={!canEdit}
              placeholder={CONDICOES_PADRAO}
              className="mt-1.5 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary disabled:opacity-60"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Aparece na página antes de a cliente pedir — é onde você diz o que
              precisa encontrar no local. Escreva com suas palavras.
            </p>
            {canEdit && !value.terms.trim() && (
              <button
                type="button"
                onClick={() => set("terms", CONDICOES_PADRAO)}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                Usar um texto pronto pra editar
              </button>
            )}
          </div>

          {/* Sem isto o interruptor liga e nada acontece na página pública, e
              não há como adivinhar por quê. */}
          <p className="flex items-start gap-2 rounded-[var(--radius)] border border-border p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Falta escolher <b className="text-foreground">quais serviços</b> você
              faz fora do salão — só eles aparecem como domicílio na sua página.{" "}
              <Link
                href={`/painel/${slug}/servicos`}
                className="font-medium text-primary hover:underline"
              >
                Marcar em Serviços
              </Link>
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
