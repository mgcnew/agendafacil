import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ArrowRight, Check, Star, CalendarCheck } from "lucide-react";

/**
 * Hero da landing — layout dividido: texto/CTA à esquerda, foto do produto
 * (devices + profissional) à direita, com card flutuante "ao vivo" que mostra
 * um agendamento chegando — prova visual de que o sistema trabalha sozinho.
 * Revelação orquestrada no load (af-rise com delays escalonados).
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Brilho quente no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(100% 60% at 70% 0%, rgba(14,111,120,0.08), transparent 60%)",
        }}
      />
      {/* Blob decorativo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-[460px] w-[460px] rounded-full opacity-[0.10]"
        style={{ background: "radial-gradient(circle, #c9a24a, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* ── Coluna de texto ──────────────────────────────────── */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="flex justify-center lg:justify-start mb-5 af-rise" style={{ animationDelay: "0.05s" }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <Star className="h-3.5 w-3.5 fill-current text-amber-400" />
                Feito para salões de beleza e barbearias
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-display text-4xl sm:text-5xl lg:text-[3.75rem] font-bold leading-[1.04] tracking-tight af-rise"
              style={{ animationDelay: "0.12s" }}
            >
              Menos WhatsApp,{" "}
              <span className="text-primary">mais clientes na cadeira.</span>
            </h1>

            {/* Subtítulo */}
            <p
              className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed af-rise"
              style={{ animationDelay: "0.2s" }}
            >
              O <strong className="font-semibold text-foreground">sistema de agendamento online</strong> para
              salões de beleza, barbearias e estética: a cliente agenda pelo seu
              link, recebe confirmação automática e você só aparece para atender.
              Sem ligação, sem caderninho, sem dor de cabeça.
            </p>

            {/* CTAs */}
            <div
              className="mt-7 flex flex-wrap justify-center lg:justify-start gap-3 af-rise"
              style={{ animationDelay: "0.28s" }}
            >
              <Link href="/criar-salao">
                <Button size="lg" className="font-semibold">
                  Começar grátis — 14 dias <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button size="lg" variant="outline">
                  Ver como funciona
                </Button>
              </a>
            </div>

            {/* Selos de confiança */}
            <ul
              className="mt-6 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-1.5 af-rise"
              style={{ animationDelay: "0.36s" }}
            >
              {[
                "Sem cartão de crédito",
                "Configurado em 2 minutos",
                "Cancele quando quiser",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Check className="h-3 w-3 text-primary shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Coluna da imagem ─────────────────────────────────── */}
          <div className="relative af-rise" style={{ animationDelay: "0.18s" }}>
            {/* Halo quente atrás da foto */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(55% 55% at 55% 45%, rgba(201,162,74,0.20), transparent 70%)",
              }}
            />
            <Image
              src="/hero-device.webp"
              alt="Zulan em uso — agenda no tablet e app no celular, num salão de beleza"
              width={2508}
              height={2508}
              quality={92}
              sizes="(max-width: 1024px) 90vw, 560px"
              className="w-full h-auto max-w-[560px] mx-auto"
              priority
              draggable={false}
            />

            {/* Card flutuante — agendamento chegando "ao vivo" */}
            <div
              className="absolute left-0 sm:-left-2 bottom-8 sm:bottom-12 af-rise"
              style={{ animationDelay: "0.6s" }}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-sm pl-2.5 pr-4 py-2.5 shadow-card">
                <span
                  className="grid place-items-center h-10 w-10 rounded-xl shrink-0"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <CalendarCheck className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">Novo agendamento</span>
                    {/* Indicador "ao vivo" */}
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping"
                        style={{ background: "var(--primary)" }}
                      />
                      <span
                        className="relative inline-flex h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                    </span>
                  </div>
                  <span className="block text-[11px] text-muted-foreground">
                    Ana Paula · hoje, 14:00 · confirmado
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
