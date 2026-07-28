import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { BARBEARIA, LiveCard, PhoneMockup } from "@/components/landing/AppMockup";
import { PLANS, priceLabel } from "@/lib/plans";
import { SITE_URL } from "@/lib/siteUrl";
import {
  ArrowRight,
  Check,
  CalendarX,
  DeviceMobile,
  NotePencil,
  Scissors,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Página dedicada a barbearias.
 *
 * Existe porque a home fala com dois públicos ao mesmo tempo e, para vender,
 * isso enfraquece os dois. Aqui a linguagem é de barbeiro — "o cliente", corte
 * e barba, cadeira vazia — e a foto é de barbearia.
 *
 * O uso principal é presencial: abrir no celular na porta da barbearia. Por
 * isso é curta, com uma promessa por bloco e um CTA só — dá pra percorrer em
 * meio minuto enquanto se conversa.
 */
export const metadata: Metadata = {
  title: "Sistema de agendamento para barbearia — agenda, WhatsApp e caixa",
  description:
    "O cliente agenda pelo seu link, recebe a confirmação no WhatsApp e é lembrado antes do horário. Menos celular na mão, menos cadeira vazia. Teste 14 dias grátis, sem cartão.",
  alternates: { canonical: "/barbearia" },
  openGraph: {
    title: "Zulan para barbearia — sua agenda trabalhando sozinha",
    description:
      "O cliente agenda pelo link, confirma no WhatsApp e você só corta. 14 dias grátis, sem cartão.",
    url: `${SITE_URL}/barbearia`,
  },
};

const DORES = [
  {
    icon: DeviceMobile,
    title: "O celular toca no meio do corte",
    text: "Cliente manda mensagem perguntando horário, você para a máquina, responde, volta. Dez vezes por dia. Com o Zulan ele agenda sozinho pelo link — e você nem precisa olhar o telefone.",
  },
  {
    icon: CalendarX,
    title: "Marcou e não apareceu",
    text: "Cadeira vazia num sábado é dinheiro que não volta. O sistema confirma o horário e lembra o cliente no WhatsApp automaticamente, sem você lembrar de nada.",
  },
  {
    icon: NotePencil,
    title: "A agenda tá na cabeça ou no caderno",
    text: "Dois clientes no mesmo horário, aquele que você esqueceu, o corte que ninguém anotou. Aqui tudo fica no lugar — e no celular, de onde você estiver.",
  },
];

const PASSOS = [
  {
    n: "1",
    title: "Cadastre seus serviços",
    text: "Corte, barba, degradê, pezinho — com preço e tempo de cada um. Leva 2 minutos.",
  },
  {
    n: "2",
    title: "Mande seu link",
    text: "Cole na bio do Instagram, no status do WhatsApp ou mande direto pro cliente.",
  },
  {
    n: "3",
    title: "Só corte",
    text: "Ele escolhe o horário, recebe a confirmação e o lembrete. Você abre o app e vê o dia pronto.",
  },
];

export default function BarbeariaPage() {
  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        {/* ── Hero ─────────────────────────────────────────────── */}
        {/* Mobile e desktop são blocos separados de propósito: a primeira
            versão compartilhava um grid e posicionava o texto com `absolute
            bottom`, mas no mobile o grid fica sem altura (o visual ao lado
            está oculto) e o texto ia parar fora da tela. */}
        <section className="relative overflow-hidden">
          {/* ── MOBILE ─────────────────────────────────────────── */}
          <div className="lg:hidden">
            {/* Altura contida: a foto situa o contexto em um relance, não
                precisa tomar a tela inteira e empurrar o CTA pra fora. */}
            <div className="relative h-[34svh] min-h-[220px] w-full">
              <Image
                src="/hero-barbearia.jpg"
                alt="Barbearia com cadeira clássica de couro, espelho e parede de tijolinho"
                fill
                quality={88}
                sizes="100vw"
                className="object-cover object-center"
                priority
                draggable={false}
              />
              {/* Véu que dissolve a base da foto no fundo da página */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2/3"
                style={{
                  background:
                    "linear-gradient(to top, var(--background) 12%, color-mix(in srgb, var(--background) 55%, transparent) 55%, transparent 100%)",
                }}
              />
            </div>

            {/* Texto em fluxo normal, subindo um pouco sobre a foto */}
            <div className="relative -mt-8 px-5 pb-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                <Scissors className="h-3 w-3 text-primary" />
                Feito para barbearia
              </span>

              <h1 className="mt-3.5 font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight sm:text-[2.6rem]">
                Pare de largar a máquina{" "}
                <span className="text-primary">pra responder WhatsApp.</span>
              </h1>

              <p className="mt-3.5 text-[15px] leading-relaxed text-muted-foreground">
                Seu cliente agenda sozinho pelo link, recebe a confirmação e é
                lembrado antes do horário.{" "}
                <strong className="font-semibold text-foreground">Você só corta.</strong>
              </p>

              <div className="mt-5 space-y-2.5">
                <Link href="/criar-salao?tipo=barbearia" className="block">
                  <Button size="lg" className="w-full font-semibold">
                    Criar minha agenda grátis <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="/demo/barbearia" className="block">
                  <Button size="lg" variant="outline" className="w-full">
                    Ver funcionando
                  </Button>
                </a>
              </div>

              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> 14 dias grátis
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> Sem cartão
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> Cancele quando quiser
                </span>
              </p>
            </div>
          </div>

          {/* ── DESKTOP ────────────────────────────────────────── */}
          <div className="mx-auto hidden max-w-6xl grid-cols-2 items-center gap-12 px-5 py-24 lg:grid">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                <Scissors className="h-3 w-3 text-primary" />
                Feito para barbearia
              </span>

              <h1 className="mt-4 font-display text-[3.5rem] font-bold leading-[1.05] tracking-tight">
                Pare de largar a máquina{" "}
                <span className="text-primary">pra responder WhatsApp.</span>
              </h1>

              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Seu cliente agenda sozinho pelo link, recebe a confirmação e é
                lembrado antes do horário.{" "}
                <strong className="font-semibold text-foreground">Você só corta.</strong>
              </p>

              <div className="mt-6 flex gap-3">
                <Link href="/criar-salao?tipo=barbearia">
                  <Button size="lg" className="font-semibold">
                    Criar minha agenda grátis <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="/demo/barbearia">
                  <Button size="lg" variant="outline">
                    Ver funcionando
                  </Button>
                </a>
              </div>

              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> 14 dias grátis
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> Sem cartão
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> Cancele quando quiser
                </span>
              </p>
            </div>

            <div className="relative">
              <div className="relative mx-auto max-w-[460px] overflow-hidden rounded-[2rem] ring-1 ring-border shadow-card">
                <Image
                  src="/hero-barbearia.jpg"
                  alt="Barbearia com cadeira clássica de couro, espelho e parede de tijolinho"
                  width={1000}
                  height={1150}
                  quality={88}
                  sizes="460px"
                  className="h-auto w-full"
                  priority
                  draggable={false}
                />
              </div>
              <div className="absolute -left-6 bottom-8 w-[200px]">
                <PhoneMockup content={BARBEARIA} />
              </div>
              <div className="absolute -right-3 top-8">
                <LiveCard name="Thiago Moura" detail="hoje, 14:30 · confirmado" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Dores ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Você conhece bem esses três.
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {DORES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-[var(--radius)] border border-border bg-card p-5"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Como funciona ────────────────────────────────────── */}
        {/* Os ids batem com os do menu (SiteHeader): sem eles os links do
            header ficavam mortos aqui, apontando pra âncoras que só a home
            tinha. */}
        <section id="como-funciona" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Três passos e tá rodando.
            </h2>

            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {PASSOS.map((p) => (
                <li key={p.n} className="relative">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-primary-foreground"
                    style={{ background: "var(--primary)" }}
                  >
                    {p.n}
                  </span>
                  <h3 className="mt-3 font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {p.text}
                  </p>
                </li>
              ))}
            </ol>

            {/* Mockup do app no mobile aparece aqui, onde tem espaço */}
            <div className="mt-12 flex justify-center lg:hidden">
              <div className="w-[240px]">
                <PhoneMockup content={BARBEARIA} />
              </div>
            </div>
          </div>
        </section>

        {/* ── WhatsApp ─────────────────────────────────────────── */}
        <section id="funcionalidades" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                <WhatsappLogo className="h-3.5 w-3.5" weight="fill" />
                No seu próprio número
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                O aviso sai do WhatsApp da sua barbearia.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Não é um número estranho mandando mensagem pro seu cliente. É o
                seu, o mesmo que ele já tem salvo. Assim que ele agenda, recebe o
                comprovante; depois do corte, o agradecimento.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Comprovante assim que o cliente marca",
                  "Agradecimento depois do atendimento",
                  "Só em horário comercial, no ritmo certo",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                <LiveCard name="Thiago Moura" detail="hoje, 14:30 · confirmado" />
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed shadow-card">
                  <p className="text-muted-foreground">
                    Fala, Thiago! ✂️<br />
                    Teu horário na{" "}
                    <b className="text-foreground">Barbearia do Bruno</b> tá marcado:
                  </p>
                  <p className="mt-3 text-foreground">
                    📅 23/05 às 14:30
                    <br />
                    💈 Corte + Barba
                  </p>
                  <p className="mt-3 text-[11px] italic text-muted-foreground">
                    Responda SAIR para não receber mais mensagens.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Preço ────────────────────────────────────────────── */}
        <section id="planos" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:py-20">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Menos que um corte por mês.
              </h2>
              <p className="mt-3 text-muted-foreground">
                14 dias grátis pra testar. Sem cartão, sem fidelidade.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {(["basic", "pro"] as const).map((id) => {
                const plan = PLANS[id];
                const destaque = id === "pro";
                return (
                  <div
                    key={id}
                    className={[
                      "relative flex flex-col rounded-[var(--radius)] border bg-card p-6",
                      destaque ? "border-primary ring-2 ring-primary/25" : "border-border",
                    ].join(" ")}
                  >
                    {destaque && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                        Mais escolhido
                      </span>
                    )}
                    <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="font-display text-3xl font-bold">
                        {priceLabel(plan.value)}
                      </span>
                      <span className="mb-1 text-sm text-muted-foreground">/mês</span>
                    </div>
                    <ul className="mt-5 flex-1 space-y-2.5">
                      {(id === "basic"
                        ? [
                            "Agenda online ilimitada",
                            "Link de agendamento",
                            "Confirmação no WhatsApp",
                            "Clientes, serviços e equipe",
                          ]
                        : [
                            "Tudo do Básico",
                            "Caixa e comissões",
                            "Controle de estoque",
                            "Relatórios e recuperação de cliente",
                          ]
                      ).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href={`/criar-salao?plano=${id}&tipo=barbearia`} className="mt-6 block">
                      <Button variant={destaque ? "primary" : "outline"} className="w-full">
                        Começar com o {plan.name}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA final ────────────────────────────────────────── */}
        <section id="demo" className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Dá uma volta na demo antes.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Uma barbearia de demonstração com agenda, caixa e comissões já
            rodando. Sem cadastro, sem cartão — é só entrar e mexer.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/demo/barbearia">
              <Button size="lg" className="w-full font-semibold sm:w-auto">
                Entrar na demo <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link href="/criar-salao?tipo=barbearia">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Criar minha agenda
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
