import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { ArrowRight, Check, Star } from "lucide-react";

export function ParallaxHero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Decoração geométrica laranja no fundo da seção */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-[0.06]"
        style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -left-20 h-[300px] w-[300px] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }}
      />

      <ContainerScroll
        titleComponent={
          <div className="px-4">
            {/* Badge */}
            <div className="flex justify-center mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Star className="h-3 w-3 fill-current text-amber-400" />
                Agendamento automático para salões de beleza
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[4.5rem] font-bold leading-[1.0] text-foreground">
              Sua agenda não para<br className="hidden sm:block" />{" "}
              <span className="text-primary">de trabalhar.</span>
            </h1>

            {/* Subtítulo */}
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              A cliente agenda pelo seu link, recebe confirmação automática e você
              só aparece para atender. Sem WhatsApp, sem ligação, sem papel.
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/criar-salao">
                <Button size="lg" className="font-semibold">
                  Começar grátis — 5 dias <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button size="lg" variant="outline">
                  Ver como funciona
                </Button>
              </a>
            </div>

            {/* Trust badges */}
            <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1.5">
              {[
                "Sem cartão de crédito",
                "Configurado em 2 minutos",
                "Cancele quando quiser",
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-primary shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
        }
      >
        {/* Imagem dentro do "device frame" 3D */}
        <Image
          src="/hero-app.webp"
          alt="Painel AgendeFácil — agenda, clientes e finanças"
          width={1456}
          height={816}
          className="w-full h-full object-cover object-top"
          priority
          draggable={false}
        />
      </ContainerScroll>
    </section>
  );
}
