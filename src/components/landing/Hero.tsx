import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";

/**
 * Hero da landing — manchete + ações à esquerda, o produto real à direita:
 * a captura da agenda num quadro grande e a página de agendamento da cliente
 * num celular sobreposto. Sem mockup desenhado: o que aparece é o painel.
 */
export function Hero() {
  return (
    <section className="relative bg-background">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-10 pb-16 sm:pt-16 lg:pt-20 lg:pb-24">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-12 lg:gap-16 items-center">
          {/* ── Texto ─────────────────────────────────────────── */}
          <div className="af-rise">
            <h1 className="font-display font-extrabold text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.4rem] tracking-[-0.035em] text-balance">
              O salão inteiro num lugar só.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-[34rem]">
              Agenda online, caixa, comissões, estoque e clientes para{" "}
              <strong className="font-semibold text-foreground">salão de beleza e barbearia</strong>{" "}
              — com uma IA que confirma horário e chama de volta quem sumiu.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link href="/criar-salao" className="zl-btn zl-btn-dark">
                Criar meu salão <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>
              <a href="#demo" className="zl-btn zl-btn-line">
                Ver por dentro, sem cadastro
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Sem cartão para testar", "Configurado em 2 minutos", "Cancele quando quiser"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-[var(--brand)]" weight="bold" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Produto ───────────────────────────────────────── */}
          <div className="relative af-rise pb-10 sm:pb-0 sm:pr-10 lg:pr-12" style={{ animationDelay: "0.12s" }}>
            <div className="overflow-hidden rounded-[var(--radius-media)] border border-border bg-secondary shadow-[var(--shadow-media)]">
              <Image
                src="/showcase-agenda.png"
                alt="Agenda do Zulan: atendimentos do dia por profissional e o assistente avisando quem ainda não chegou"
                width={2880}
                height={1800}
                priority
                sizes="(max-width: 1024px) 92vw, 700px"
                className="w-full h-auto"
              />
            </div>

            {/* Celular — página de agendamento da cliente */}
            <div className="absolute -bottom-2 right-0 sm:-bottom-10 w-[30%] max-w-[190px] min-w-[112px]">
              <div className="rounded-[1.9rem] bg-[#0d1014] p-[6px] shadow-[var(--shadow-media)]">
                <div className="relative overflow-hidden rounded-[1.5rem] bg-white" style={{ aspectRatio: "390 / 760" }}>
                  <Image
                    src="/showcase-booking.png"
                    alt="Página de agendamento do salão no celular da cliente, com a lista de serviços"
                    fill
                    sizes="190px"
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
