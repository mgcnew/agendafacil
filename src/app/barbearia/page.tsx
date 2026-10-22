import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { figtree } from "@/components/landing/fonts";
import { PLANS, priceLabel } from "@/lib/plans";
import { SITE_URL } from "@/lib/siteUrl";
import { ArrowRight, Check, Checks, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

/**
 * Página dedicada a barbearias.
 *
 * Existe porque a home fala com dois públicos ao mesmo tempo e, para vender,
 * isso enfraquece os dois. Aqui a linguagem é de barbeiro — "o cliente", corte
 * e barba, cadeira vazia — e a foto é de barbearia. Mesmo mundo visual da home
 * (classe .zl), outra voz.
 *
 * O uso principal é presencial: abrir no celular na porta da barbearia. Por
 * isso é curta, com uma promessa por bloco — dá pra percorrer em meio minuto
 * enquanto se conversa.
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
    title: "O celular toca no meio do corte",
    text: "Cliente manda mensagem perguntando horário, você para a máquina, responde, volta. Dez vezes por dia. Com o Zulan ele agenda sozinho pelo link — e você nem precisa olhar o telefone.",
  },
  {
    title: "Marcou e não apareceu",
    text: "Cadeira vazia num sábado é dinheiro que não volta. O sistema confirma o horário e lembra o cliente no WhatsApp automaticamente, sem você lembrar de nada.",
  },
  {
    title: "A agenda tá na cabeça ou no caderno",
    text: "Dois clientes no mesmo horário, aquele que você esqueceu, o corte que ninguém anotou. Aqui tudo fica no lugar — e no celular, de onde você estiver.",
  },
];

const PASSOS = [
  {
    title: "Cadastre seus serviços",
    text: "Corte, barba, degradê, pezinho — com preço e tempo de cada um.",
  },
  {
    title: "Mande seu link",
    text: "Cole na bio do Instagram, no status do WhatsApp ou mande direto pro cliente.",
  },
  {
    title: "Só corte",
    text: "Ele escolhe o horário, recebe a confirmação e o lembrete. Você abre o app e vê o dia pronto.",
  },
];

const PLANOS: { id: "basic" | "pro"; role: string; features: string[] }[] = [
  {
    id: "basic",
    role: "Agenda",
    features: [
      "Agenda online ilimitada",
      "Link de agendamento",
      "Confirmação no WhatsApp",
      "Clientes, serviços e equipe",
    ],
  },
  {
    id: "pro",
    role: "Gestão completa",
    features: [
      "Tudo do Básico",
      "Caixa e comissões",
      "Controle de estoque",
      "Relatórios e recuperação de cliente",
    ],
  },
];

/**
 * A confirmação que o cliente recebe — o texto bate com o que o produto manda
 * de verdade na primeira mensagem (assinatura e aviso de saída inclusos),
 * senão a página promete outra coisa. Nome e horário são de exemplo.
 */
function MensagemWhatsApp({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`rounded-[1.25rem] border border-border bg-card p-4 text-[0.92rem] leading-relaxed shadow-[var(--shadow-media)] ${className}`}
    >
      <figcaption className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <WhatsappLogo aria-hidden className="h-4 w-4 text-[#25a244]" weight="fill" />
        Barbearia do Bruno · exemplo
      </figcaption>
      <div className="rounded-2xl rounded-tl-sm bg-[#e7f7e1] px-3.5 py-3 text-[#10261a]">
        <p>
          Fala, Thiago! ✂️
          <br />
          Teu horário na <b>Barbearia do Bruno</b> tá marcado:
        </p>
        <p className="mt-2.5">
          📅 23/05 às 14:30
          <br />
          💈 Corte + Barba
        </p>
        <p className="mt-2.5">— Bruno</p>
        <p className="mt-2.5 text-[11px] italic text-[#10261a]/70">
          Se um dia não quiser mais receber mensagens, é só responder SAIR.
        </p>
        <p className="mt-1 flex justify-end items-center gap-1 text-[10px] text-[#10261a]/60">
          14:02 <Checks aria-hidden className="h-3.5 w-3.5 text-[#34b7f1]" weight="bold" />
        </p>
      </div>
    </figure>
  );
}

export default function BarbeariaPage() {
  return (
    <div className={`zl ${figtree.variable} flex flex-col min-h-full overflow-x-clip pb-20 sm:pb-0`}>
      <SiteHeader />

      <main>
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 pt-6 pb-16 sm:pt-14 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
            {/* Foto primeiro no celular: situa em um relance quem chega pela
                porta da barbearia. No desktop vai para a direita. */}
            <div className="relative lg:order-2 af-rise">
              <div className="relative overflow-hidden rounded-[var(--radius-media)] bg-secondary aspect-[4/3] lg:aspect-[4/5]">
                <Image
                  src="/nicho-barbearia.jpg"
                  alt="Barbeiro aparando a barba de um cliente numa cadeira de couro, numa barbearia de tijolinho"
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 600px"
                  className="object-cover object-[60%_center]"
                />
              </div>
              {/* A prova do mecanismo, em cima da foto: é isso que o cliente
                  recebe sem o barbeiro largar a máquina. */}
              <MensagemWhatsApp className="hidden lg:block absolute -left-10 bottom-10 w-[300px]" />
            </div>

            <div className="lg:order-1 af-rise" style={{ animationDelay: "0.08s" }}>
              <h1 className="font-display font-extrabold text-[2.4rem] leading-[1.03] sm:text-6xl lg:text-[4.2rem] tracking-[-0.035em] text-balance">
                Pare de largar a máquina pra responder WhatsApp.
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-[34rem]">
                Seu cliente agenda sozinho pelo link, recebe a confirmação e é
                lembrado antes do horário.{" "}
                <strong className="font-semibold text-foreground">Você só corta.</strong>
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link href="/criar-salao?tipo=barbearia" className="zl-btn zl-btn-dark">
                  Criar minha agenda grátis <ArrowRight className="h-4 w-4" weight="bold" />
                </Link>
                {/* prefetch={false}: /demo faz login; o prefetch logaria sem clique. */}
                <Link href="/demo/barbearia" prefetch={false} className="zl-btn zl-btn-line">
                  Ver funcionando
                </Link>
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["14 dias grátis", "Sem cartão", "Cancele quando quiser"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-[var(--brand)]" weight="bold" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── DORES ────────────────────────────────────────────────── */}
        <section aria-labelledby="dores-titulo" className="py-16 sm:py-24 bg-secondary">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 id="dores-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] max-w-2xl">
              Você conhece bem esses três.
            </h2>
            <div className="mt-10 sm:mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {DORES.map((d) => (
                <div key={d.title} className="border-t-2 border-foreground pt-5">
                  <h3 className="font-display font-bold text-xl sm:text-2xl tracking-[-0.02em] text-balance">{d.title}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{d.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMO FUNCIONA ────────────────────────────────────────── */}
        {/* Os ids batem com os do menu (SiteHeader), compartilhado com a home. */}
        <section id="como-funciona" aria-labelledby="passos-titulo" className="py-16 sm:py-24 scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 id="passos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em]">
              Três passos e tá rodando.
            </h2>
            <ol className="mt-10 sm:mt-14 grid gap-8 md:grid-cols-3">
              {PASSOS.map((p, i) => (
                <li key={p.title} className="grid grid-cols-[2.75rem_1fr] gap-5">
                  <span className="grid place-items-center h-11 w-11 rounded-full bg-foreground text-background font-display font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-xl tracking-[-0.01em]">{p.title}</h3>
                    <p className="mt-1.5 text-muted-foreground leading-relaxed">{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── WHATSAPP ─────────────────────────────────────────────── */}
        <section id="funcionalidades" aria-labelledby="whats-titulo" className="py-16 sm:py-24 border-t border-border scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <h2 id="whats-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-balance">
                O aviso sai do WhatsApp da sua barbearia.
              </h2>
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">
                Não é um número estranho mandando mensagem pro seu cliente. É o
                seu, o mesmo que ele já tem salvo. Assim que ele agenda, recebe o
                comprovante; depois do corte, o agradecimento.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Comprovante assim que o cliente marca",
                  "Agradecimento depois do atendimento",
                  "Só em horário comercial, no ritmo certo",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" weight="bold" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <MensagemWhatsApp className="w-full max-w-sm mx-auto lg:mx-0 lg:justify-self-end" />
          </div>
        </section>

        {/* ── DEMONSTRAÇÃO ─────────────────────────────────────────── */}
        <section id="demo" aria-labelledby="demo-titulo" className="scroll-mt-16 px-3 sm:px-5">
          <div className="mx-auto max-w-7xl rounded-[2rem] bg-[var(--ink-band)] text-white px-6 py-16 sm:px-14 sm:py-20 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-center">
            <div>
              <h2 id="demo-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-balance">
                Dá uma volta numa barbearia de verdade.
              </h2>
              <p className="mt-4 text-lg text-white/75 max-w-xl leading-relaxed">
                Uma barbearia de demonstração com agenda, caixa e comissões já
                rodando, com dados de exemplo. Sem cadastro, sem cartão — é só
                entrar e mexer.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 lg:items-start xl:justify-end">
              <Link href="/demo/barbearia" prefetch={false} className="zl-btn zl-btn-light">
                Entrar na demo <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── PLANOS ───────────────────────────────────────────────── */}
        <section id="planos" aria-labelledby="planos-titulo" className="py-16 sm:py-24 scroll-mt-16">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <h2 id="planos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em]">
              Menos que um corte por mês.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              14 dias grátis pra testar. Sem cartão, sem fidelidade.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {PLANOS.map((p) => {
                const plan = PLANS[p.id];
                return (
                  <div key={p.id} className="flex flex-col rounded-[var(--radius-media)] border border-border bg-card p-7">
                    <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{plan.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--brand)]">{p.role}</p>
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-extrabold tracking-[-0.03em] tabular-nums">
                        {priceLabel(plan.value)}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                    </p>
                    <ul className="mt-6 space-y-3 flex-1 border-t border-border pt-6">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" weight="bold" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/criar-salao?plano=${p.id}&tipo=barbearia`}
                      className={`mt-8 zl-btn w-full ${p.id === "pro" ? "zl-btn-dark" : "zl-btn-line"}`}
                    >
                      Começar com o {plan.name}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FECHAMENTO ───────────────────────────────────────────── */}
        <section aria-labelledby="fim-titulo" className="pb-20 sm:pb-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="rounded-[2rem] bg-secondary px-6 py-14 sm:px-14 sm:py-20 text-center">
              <h2 id="fim-titulo" className="mx-auto max-w-3xl font-display font-extrabold text-3xl sm:text-6xl tracking-[-0.035em] text-balance">
                Largue o celular. Pegue a máquina.
              </h2>
              <p className="mt-5 text-lg text-muted-foreground">
                14 dias grátis · Sem cartão · Cancele quando quiser
              </p>
              <div className="mt-9 flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/criar-salao?tipo=barbearia" className="zl-btn zl-btn-dark">
                  Criar minha agenda grátis <ArrowRight className="h-4 w-4" weight="bold" />
                </Link>
                <Link href="/demo/barbearia" prefetch={false} className="zl-btn zl-btn-line">
                  Ver funcionando
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter vertical="barbearia" />

      {/* CTA fixo no celular — a página é lida na porta da barbearia */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md p-3 sm:hidden">
        <Link href="/criar-salao?tipo=barbearia" className="zl-btn zl-btn-dark w-full">
          Criar minha agenda grátis <ArrowRight className="h-4 w-4" weight="bold" />
        </Link>
      </div>
    </div>
  );
}
