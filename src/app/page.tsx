import Link from "next/link";
import { NicheShowcase } from "@/components/landing/NicheShowcase";
import { Button } from "@/components/ui";
import {
  CalendarCheck,
  Users,
  ShieldCheck,
  Wallet,
  Boxes,
  Percent,
  Link2,
  Smartphone,
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 80% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent), radial-gradient(50% 50% at 10% 20%, color-mix(in srgb, var(--primary) 22%, transparent), transparent)",
          }}
        />
        <div className="af-grain absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl">
            <span className="af-rise inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> App instalável • multiusuário • multi-salão
            </span>
            <h1
              className="af-rise font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.95] mt-6"
              style={{ animationDelay: "0.05s" }}
            >
              O sistema completo do seu{" "}
              <span className="text-primary">salão</span> e{" "}
              <span className="text-accent">barbearia</span>.
            </h1>
            <p
              className="af-rise text-lg text-muted-foreground mt-6 max-w-xl"
              style={{ animationDelay: "0.12s" }}
            >
              Agendamento online pela sua cliente, controle de equipe com permissões,
              comissões, caixa e estoque — tudo num app que tem a cara do seu negócio.
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
                <Button size="lg" variant="outline">
                  Acessar painel
                </Button>
              </Link>
            </div>
            <p className="af-rise text-sm text-muted-foreground mt-5" style={{ animationDelay: "0.24s" }}>
              <Link2 className="inline h-4 w-4 mr-1" />
              Sua cliente agenda por um link:{" "}
              <span className="font-mono text-foreground">agendefacil.app/seu-salao</span>
            </p>
          </div>
        </div>
      </section>

      {/* Showcase de nichos */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <NicheShowcase />
      </section>

      {/* Features */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Tudo num só lugar
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">
              Da recepção ao caixa, sem planilha.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-[var(--radius)] border border-border bg-card p-6 hover:shadow-lg transition-shadow"
              >
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-secondary text-secondary-foreground">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold mt-4">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <div
          className="relative overflow-hidden rounded-[var(--radius)] p-10 sm:p-16 text-center text-primary-foreground"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          <div className="af-grain absolute inset-0 opacity-25" />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-5xl font-bold">
              Pronta para encher a agenda?
            </h2>
            <p className="mt-4 text-primary-foreground/85 max-w-md mx-auto">
              Crie o seu salão em menos de 2 minutos e compartilhe o link com as clientes.
            </p>
            <Link href="/criar-salao" className="inline-block mt-8">
              <Button size="lg" variant="outline" className="bg-card">
                Criar meu salão agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-display font-semibold text-foreground">
            <Scissors className="h-4 w-4" /> AgendeFácil
          </p>
          <p>© {new Date().getFullYear()} — Feito para salões, barbearias e estética.</p>
        </div>
      </footer>
    </div>
  );
}
