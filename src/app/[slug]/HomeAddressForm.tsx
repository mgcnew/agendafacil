"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui";
import { CircleNotch, House, MapPin } from "@phosphor-icons/react/dist/ssr";
import { formatCep, isValidCep, onlyDigits } from "@/lib/cep";
import { formatBRL } from "@/lib/utils";
import { homeServiceFee, regraTarifa, type Tarifa } from "@/lib/homeService";
import { lookupCepPublic } from "./cepAction";

export type Endereco = {
  cep: string;
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const ENDERECO_VAZIO: Endereco = {
  cep: "",
  street: "",
  street_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

/** Só o CEP e o número são realmente digitados; o resto vem dos Correios. */
export function enderecoCompleto(e: Endereco): boolean {
  return e.street.trim() !== "" && e.street_number.trim() !== "";
}

/**
 * Endereço do atendimento em domicílio.
 *
 * CEP e número — dois campos. Rua, bairro, cidade e UF vêm dos Correios. Quem
 * já pediu domicílio antes não digita nada: chega tudo preenchido.
 *
 * `kmConhecido` é o que separa os dois mundos. Quando existe (cliente que já
 * foi atendida em casa), a taxa aparece fechada, na hora. Quando não existe,
 * mostramos a REGRA e prometemos o valor — porque quem decide se vai naquele
 * endereço é a profissional, e essa decisão nunca foi automática.
 */
export function HomeAddressForm({
  value,
  onChange,
  tarifa,
  kmConhecido,
  maxKm,
  terms,
  salonCity,
}: {
  value: Endereco;
  onChange: (e: Endereco) => void;
  tarifa: Tarifa;
  kmConhecido: number | null;
  maxKm: number | null;
  terms: string | null;
  salonCity: string | null;
}) {
  const [buscando, setBuscando] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);

  const set = <K extends keyof Endereco>(k: K, v: Endereco[K]) =>
    onChange({ ...value, [k]: v });

  async function buscarCep(bruto: string) {
    const digitos = onlyDigits(bruto);
    if (!isValidCep(digitos)) return;
    setBuscando(true);
    setCepMsg(null);
    try {
      const r = await lookupCepPublic(digitos);
      if (!r) {
        setCepMsg("Não achamos esse CEP. Pode preencher o endereço à mão.");
        return;
      }
      onChange({
        ...value,
        cep: formatCep(digitos),
        street: r.street ?? value.street,
        neighborhood: r.neighborhood ?? value.neighborhood,
        city: r.city ?? value.city,
        state: r.state ?? value.state,
      });
    } catch {
      setCepMsg("Não conseguimos consultar agora. Pode preencher à mão.");
    } finally {
      setBuscando(false);
    }
  }

  // Cidade diferente da do salão é o único "fora de área" que dá pra afirmar
  // sem saber a distância. Aviso, não bloqueio: quem mora na divisa pode estar
  // a 3 km mesmo em outro município.
  const outraCidade =
    !!salonCity &&
    !!value.city &&
    value.city.trim().toLowerCase() !== salonCity.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <House className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Onde vamos te atender</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div>
          <Label htmlFor="hs-cep">CEP</Label>
          <div className="relative">
            <Input
              id="hs-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              value={value.cep}
              onChange={(e) => {
                const v = formatCep(e.target.value);
                set("cep", v);
                if (onlyDigits(v).length === 8) void buscarCep(v);
              }}
              placeholder="00000-000"
              aria-busy={buscando}
              aria-describedby="hs-cep-msg"
            />
            {buscando && (
              <CircleNotch
                aria-hidden
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
              />
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="hs-street">Rua</Label>
          <Input
            id="hs-street"
            autoComplete="address-line1"
            value={value.street}
            onChange={(e) => set("street", e.target.value)}
            placeholder="Preenchemos pelo CEP"
            required
            aria-invalid={value.street.trim() === ""}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="hs-num">Número</Label>
          <Input
            id="hs-num"
            value={value.street_number}
            onChange={(e) => set("street_number", e.target.value)}
            placeholder="26"
            required
            aria-invalid={value.street_number.trim() === ""}
            autoComplete="address-line2"
          />
        </div>
        <div>
          <Label htmlFor="hs-compl">Complemento</Label>
          <Input
            id="hs-compl"
            value={value.complement}
            onChange={(e) => set("complement", e.target.value)}
            placeholder="Apto, bloco, referência"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
        <div>
          <Label htmlFor="hs-bairro">Bairro</Label>
          <Input id="hs-bairro" value={value.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="hs-cidade">Cidade</Label>
          <Input id="hs-cidade" value={value.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="hs-uf">UF</Label>
          <Input id="hs-uf" maxLength={2} value={value.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
        </div>
      </div>

      {/* Região viva: a busca do CEP é assíncrona e o resultado precisa ser
          anunciado — quem não vê a tela não percebe os campos se preenchendo
          sozinhos, nem o aviso de que o CEP não foi encontrado. */}
      <p id="hs-cep-msg" role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {buscando ? "Buscando endereço pelo CEP…" : cepMsg}
      </p>

      {outraCidade && (
        <p role="status" aria-live="polite" className="flex items-start gap-2 rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esse endereço fica em <b>{value.city}</b> e o salão atende a partir de{" "}
            <b>{salonCity}</b>. Pode ser que fique fora da área — a gente confere
            e te avisa antes de confirmar.
          </span>
        </p>
      )}

      {/* O valor, ou a promessa dele. Nunca as duas coisas ao mesmo tempo. */}
      <div className="rounded-[var(--radius)] border border-border bg-muted/40 p-4">
        {kmConhecido != null ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm">Taxa de deslocamento</span>
              <b className="font-display text-lg text-primary">
                {formatBRL(homeServiceFee(kmConhecido, tarifa))}
              </b>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Já somado no total. Calculado sobre os{" "}
              {kmConhecido.toLocaleString("pt-BR")} km até seu endereço.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Taxa de deslocamento: {regraTarifa(tarifa)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Como é seu primeiro atendimento em casa, conferimos a distância e
              te mandamos o valor exato pelo WhatsApp{" "}
              <b className="text-foreground">antes de confirmar</b>. Você não fica
              com nenhuma surpresa.
            </p>
          </>
        )}
        {maxKm != null && kmConhecido == null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Atendemos em domicílio até {maxKm.toLocaleString("pt-BR")} km do salão.
          </p>
        )}
      </div>

      {terms?.trim() && (
        <div className="rounded-[var(--radius)] border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Para o atendimento em casa
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{terms.trim()}</p>
        </div>
      )}
    </div>
  );
}
