import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ArrowRight, Check, Scissors, Star } from "@phosphor-icons/react/dist/ssr";
import { LiveCard, PhoneMockup } from "./AppMockup";

/**
 * Hero da landing.
 *  - Mobile (< lg): o mockup do app (HTML/CSS, sempre nítido e na marca) é o
 *    visual principal, centralizado, com o card "ao vivo" sobreposto no topo —
 *    sem a foto, que ficava apertada e cobria a composição no celular.
 *  - Desktop (lg+): composição completa — foto na marca + mockup sobreposto +
 *    card flutuante.
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
              Sua recepcionista virtual,{" "}
              <span className="text-primary">24 horas por dia.</span>
            </h1>

            {/* Subtítulo */}
            <p
              className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed af-rise"
              style={{ animationDelay: "0.2s" }}
            >
              O <strong className="font-semibold text-foreground">sistema de agendamento online com inteligência artificial</strong> para
              salões de beleza, barbearias e estética. A cliente agenda pelo seu
              link e recebe confirmação automática; a IA organiza sua agenda,
              recupera quem deixou de aparecer e ainda cria suas artes de
              divulgação. Você só aparece para atender.
            </p>

            {/* CTAs */}
            <div
              className="mt-7 flex flex-wrap justify-center lg:justify-start gap-3 af-rise"
              style={{ animationDelay: "0.28s" }}
            >
              <a href="#demo">
                <Button size="lg" className="font-semibold">
                  Ver o sistema por dentro <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
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
                "Sem cadastro para testar",
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

            {/* Desvio pra barbearia, acima da dobra de propósito: esta home
                fala a língua de salão ("a cliente"), e o barbeiro que cai aqui
                precisa da porta antes de decidir sair — não no meio do scroll. */}
            <div
              className="mt-6 flex justify-center lg:justify-start af-rise"
              style={{ animationDelay: "0.44s" }}
            >
              <Link
                href="/barbearia"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary"
              >
                <Scissors className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  Tem barbearia?{" "}
                  <span className="font-semibold text-foreground">
                    Veja a página feita pra você
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* ── Coluna do visual ─────────────────────────────────── */}
          <div className="relative af-rise" style={{ animationDelay: "0.18s" }}>
            {/* Halo quente atrás do visual */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(55% 55% at 55% 45%, rgba(201,162,74,0.20), transparent 70%)",
              }}
            />

            {/* ── MOBILE / TABLET (< lg): mockup centralizado ─────── */}
            <div className="lg:hidden">
              <div className="relative mx-auto w-[248px] max-w-full pt-6">
                <PhoneMockup />
                {/* Card "ao vivo" sobreposto no topo, sem estourar a borda */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-[260px] max-w-[86vw] af-rise"
                  style={{ animationDelay: "0.5s" }}
                >
                  <LiveCard />
                </div>
              </div>
            </div>

            {/* ── DESKTOP (lg+): composição foto + mockup + card ──── */}
            <div className="hidden lg:block relative">
              {/* Foto na marca (dona + salão) */}
              <div className="relative mx-auto max-w-[520px] overflow-hidden rounded-[2rem] ring-1 ring-border shadow-card">
                <Image
                  src="/hero-zulan.jpg"
                  alt="Dona de salão de beleza usando o Zulan no dia a dia"
                  width={886}
                  height={1182}
                  quality={92}
                  sizes="520px"
                  className="w-full h-auto"
                  priority
                  draggable={false}
                />
              </div>

              {/* Mockup do app (HTML/CSS) sobreposto no canto inferior esquerdo */}
              <div
                className="absolute -left-6 bottom-8 w-[212px] af-rise"
                style={{ animationDelay: "0.5s" }}
                aria-hidden
              >
                <PhoneMockup />
              </div>

              {/* Card flutuante — agendamento chegando "ao vivo" */}
              <div
                className="absolute -right-3 top-10 af-rise"
                style={{ animationDelay: "0.66s" }}
              >
                <LiveCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
