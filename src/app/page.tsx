import Link from "next/link";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { NICHE_LIST } from "@/lib/themes";
import { Button } from "@/components/ui";
import {
  CalendarCheck,
  Users,
  ShieldCheck,
  Wallet,
  Boxes,
  Percent,
  Link2,
  Sparkles,
  ArrowRight,
  Scissors,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Agenda inteligente",
    desc: "Horários por profissional, encaixes e bloqueios. A cliente agenda sozinha pelo link.",
  },
  {
    icon: ShieldCheck,
    title: "Permissões granulares",
    desc: "Cargos de recepção a gerente. Defina exatamente o que cada funcionária pode ver e fazer.",
  },
  {
    icon: Percent,
    title: "Comissões automáticas",
    desc: "Cada serviço gera a comissão do profissional. Fechamento sem planilha.",
  },
  {
    icon: Wallet,
    title: "Caixa & financeiro",
    desc: "Abertura, fechamento, entradas e saídas por forma de pagamento.",
  },
  {
    icon: Boxes,
    title: "Controle de estoque",
    desc: "Produtos, baixa automática por serviço e alerta de estoque mínimo.",
  },
  {
    icon: Users,
    title: "Ficha da cliente",
    desc: "Histórico de serviços, preferências e retorno — a cliente vê o que já fez.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
              <Scissors className="h-5 w-5" />
            </span>
            AgendeFácil
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/entrar">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link href="/criar-salao">
              <Button size="sm">Criar meu salão</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — duas colunas */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(55% 50% at 85% 10%, color-mix(in srgb, var(--accent) 28%, transparent), transparent), radial-gradient(45% 45% at 5% 30%, color-mix(in srgb, var(--primary) 20%, transparent), transparent)",
          }}
        />
        <div className="af-grain absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Texto */}
            <div>
              <span className="af-rise inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Agendamento online para o seu negócio de beleza
              </span>
              <h1
                className="af-rise font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.98] mt-6"
                style={{ animationDelay: "0.05s" }}
              >
                Sua agenda{" "}
                <span className="relative whitespace-nowrap text-primary">
                  cheia
                  <svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 200 12"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M2 9C40 3 160 3 198 9"
                      stroke="var(--accent)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                , sem esforço.
              </h1>
              <p
                className="af-rise text-lg text-muted-foreground mt-6 max-w-md"
                style={{ animationDelay: "0.12s" }}
              >
                A cliente agenda pelo seu link em segundos. Você controla equipe,
                comissões, caixa e estoque — tudo num app com a cara do seu salão.
              </p>
              <div
                className="af-rise flex flex-wrap gap-3 mt-8"
                style={{ animationDelay: "0.18s" }}
              >
                <Link href="/criar-salao">
                  <Button size="lg">
                    Começar grátis <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/entrar">
                  <Button size="lg" variant="outline">Acessar painel</Button>
                </Link>
              </div>
              <p
                className="af-rise text-sm text-muted-foreground mt-5 flex items-center gap-1.5"
                style={{ animationDelay: "0.24s" }}
              >
                <Link2 className="h-4 w-4" />
                Seu link:{" "}
                <span className="font-mono text-foreground">agendefacil.app/seu-salão</span>
              </p>
            </div>

            {/* Mockup */}
            <div className="af-rise" style={{ animationDelay: "0.2s" }}>
              <PhoneMockup />
            </div>
          </div>

          {/* Menção limpa aos segmentos */}
          <div className="af-rise mt-14 sm:mt-20 border-t border-border pt-8" style={{ animationDelay: "0.3s" }}>
            <p className="text-center text-sm text-muted-foreground">
              Um tema sob medida para o seu segmento — você escolhe ao criar o salão.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-5">
              {NICHE_LIST.map((n) => (
                <span key={n.id} className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="h-3 w-3 rounded-full" style={{ background: n.swatch }} />
                  {n.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Tudo num só lugar
            </p>
            <h2 className="font-display text-3xl sm:text-4xl mt-3">
              Da recepção ao caixa, sem planilha.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-[var(--radius)] border border-border bg-card p-6 hover:shadow-card transition-shadow"
              >
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-secondary text-secondary-foreground">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg mt-4">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final — painel verde profundo, contido */}
      <section className="px-5 py-20 sm:py-28">
        <div
          className="relative overflow-hidden mx-auto max-w-5xl rounded-[2.25rem] px-8 py-14 sm:px-16 sm:py-20 text-center"
          style={{ background: "linear-gradient(155deg, #0d564d 0%, #0a3a34 100%)" }}
        >
          {/* brilho suave de menta */}
          <div
            className="absolute -top-28 left-1/2 -translate-x-1/2 h-64 w-[40rem] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(closest-side, rgba(45,212,191,0.30), transparent)" }}
            aria-hidden
          />
          <div className="af-grain absolute inset-0 opacity-[0.08]" aria-hidden />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              <Scissors className="h-3.5 w-3.5" /> AgendeFácil
            </span>
            <h2 className="font-display text-3xl sm:text-5xl text-white mt-5">
              Pronta para encher a agenda?
            </h2>
            <p className="mt-4 text-white/75 max-w-md mx-auto">
              Crie o seu salão em menos de 2 minutos e compartilhe o link com as clientes.
            </p>
            <Link href="/criar-salao" className="inline-block mt-8">
              <Button
                size="lg"
                variant="outline"
                className="bg-white text-[#0a3a34] border-transparent hover:bg-white/90"
              >
                Criar meu salão agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-5 text-xs text-white/55">
              Sem cartão de crédito · Configuração em 2 minutos
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-display font-semibold text-foreground">
            <Scissors className="h-4 w-4" /> AgendeFácil
          </p>
          <p>© 2026 — Feito para salões, barbearias e estética.</p>
        </div>
      </footer>
    </div>
  );
}
