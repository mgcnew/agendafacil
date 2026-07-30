"use client";

import { Input } from "@/components/ui";
import { House, Storefront, Warning } from "@phosphor-icons/react/dist/ssr";
import { formatBRL } from "@/lib/utils";
import { homeServiceFee } from "@/lib/homeService";
import type { Client, HomeConfig } from "./shared";
import type { Endereco } from "@/app/[slug]/HomeAddressForm";

/**
 * Escolha de modalidade no agendamento pelo painel.
 *
 * Diferente da página pública em uma coisa que muda tudo: aqui quem marca é do
 * salão, atendendo no telefone, e a cliente quase sempre já tem endereço na
 * ficha. Então o caminho comum é ZERO digitação — mostra o endereço conhecido
 * e o valor, e pronto. Os campos só aparecem pra quem nunca foi atendida em
 * casa.
 *
 * Cliente nova (ainda sem ficha) não pode pedir domicílio por aqui: sem ficha
 * não há onde guardar endereço. A tela diz isso em vez de falhar no salvar.
 */
export function HomeModePicker({
  config,
  modo,
  onModo,
  cliente,
  endereco,
  onEndereco,
  temServicoDeCasa,
}: {
  config: HomeConfig;
  modo: "salon" | "home";
  onModo: (m: "salon" | "home") => void;
  /** null = cliente ainda não existe (vai ser criada agora). */
  cliente: Client | null;
  endereco: Endereco;
  onEndereco: (e: Endereco) => void;
  /** Algum dos serviços escolhidos sai do salão. */
  temServicoDeCasa: boolean;
}) {
  if (!config.enabled) return null;

  const emCasa = modo === "home";
  const km = cliente?.distance_km == null ? null : Number(cliente.distance_km);
  const temEnderecoNaFicha = !!cliente?.street && !!cliente?.street_number;
  const enderecoConhecido = temEnderecoNaFicha
    ? [
        [cliente!.street, cliente!.street_number].filter(Boolean).join(", "),
        cliente!.neighborhood,
        [cliente!.city, cliente!.state].filter(Boolean).join("/"),
      ]
        .filter(Boolean)
        .join(" — ")
    : null;

  const set = <K extends keyof Endereco>(k: K, v: Endereco[K]) =>
    onEndereco({ ...endereco, [k]: v });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {([
          { id: "salon", Icon: Storefront, label: "No espaço" },
          { id: "home", Icon: House, label: "Em domicílio" },
        ] as const).map(({ id, Icon, label }) => {
          const on = modo === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onModo(id)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-[var(--radius)] border p-2.5 text-sm transition ${
                on ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-foreground/25"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
              {label}
            </button>
          );
        })}
      </div>

      {emCasa && !temServicoDeCasa && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Nenhum dos serviços escolhidos é feito fora do salão. Marque em
          Serviços quais você faz em domicílio.
        </p>
      )}

      {emCasa && !cliente && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Escolha uma cliente já cadastrada — o endereço fica na ficha dela.
        </p>
      )}

      {emCasa && cliente && (
        <div className="rounded-[var(--radius)] border border-primary/30 bg-primary/[0.04] p-3 space-y-2">
          {enderecoConhecido ? (
            <>
              <p className="text-xs text-muted-foreground">Endereço na ficha</p>
              <p className="text-sm">{enderecoConhecido}</p>
            </>
          ) : (
            <>
              {/* Primeira vez desta cliente em casa: os campos aparecem aqui e
                  o que for digitado vai pra ficha dela, não só pra este
                  agendamento. */}
              <p className="text-xs text-muted-foreground">
                Primeira vez em domicílio — o endereço fica salvo na ficha.
              </p>
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <Input
                  value={endereco.street}
                  onChange={(e) => set("street", e.target.value)}
                  placeholder="Rua"
                />
                <Input
                  value={endereco.street_number}
                  onChange={(e) => set("street_number", e.target.value)}
                  placeholder="Nº"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={endereco.neighborhood}
                  onChange={(e) => set("neighborhood", e.target.value)}
                  placeholder="Bairro"
                />
                <Input
                  value={endereco.complement}
                  onChange={(e) => set("complement", e.target.value)}
                  placeholder="Complemento"
                />
              </div>
            </>
          )}

          <div className="border-t border-border/60 pt-2 text-sm">
            {km != null ? (
              <span>
                Deslocamento:{" "}
                <b className="text-primary">
                  {formatBRL(homeServiceFee(km, config))}
                </b>{" "}
                <span className="text-xs text-muted-foreground">
                  ({km.toLocaleString("pt-BR")} km da ficha)
                </span>
              </span>
            ) : (
              // Sem km não dá pra fechar valor, então nem finge que dá: o
              // agendamento nasce como pedido e a taxa entra na confirmação.
              <span className="text-xs text-muted-foreground">
                Ainda não temos a distância desta cliente. O agendamento entra
                como <b className="text-foreground">pedido</b> e você informa o
                km ao confirmar — depois disso, sai pronto toda vez.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
