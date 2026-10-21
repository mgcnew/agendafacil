import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "@/components/InlineScript";
import { PLANS, priceLabel, SUBSCRIBABLE_PLANS } from "@/lib/plans";
import { Hero } from "@/components/landing/Hero";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { BenefitsQA } from "@/components/landing/BenefitsQA";
import { figtree } from "@/components/landing/fonts";
import { ArrowRight, Check, Plus, Star } from "@phosphor-icons/react/dist/ssr";
import { SITE_URL } from "@/lib/siteUrl";

// SEO específico da home — sobrescreve o default do layout com foco nas
// buscas que a dona de salão/barbearia faz no Google.
export const metadata: Metadata = {
  title:
    "Sistema de agendamento online com IA para salões de beleza e barbearias",
  description:
    "Zulan é a gestão completa do salão e da barbearia: agenda online com link para clientes, confirmação automática, caixa, comissões, estoque e clientes — com IA que recupera quem sumiu. Entre na demonstração e veja o sistema por dentro, sem cadastro.",
  alternates: { canonical: "/" },
};

// ── Dados ──────────────────────────────────────────────────────────────────

const PLAN_CARDS: {
  id: "basic" | "pro" | "max";
  role: string;
  pitch: string;
  features: string[];
}[] = [
  {
    id: "basic",
    role: "Agenda",
    pitch: "Para parar de marcar horário pelo WhatsApp.",
    features: [
      "Agenda online ilimitada",
      "Link de agendamento para clientes",
      "Confirmação e lembretes no WhatsApp",
      "Cadastro de clientes, serviços e equipe",
    ],
  },
  {
    id: "pro",
    role: "Gestão completa",
    pitch: "Agenda, dinheiro e clientes do salão num lugar só.",
    features: [
      "Tudo do Básico",
      "Caixa e comissões automatizados",
      "Controle de estoque",
      "Campanhas e recuperação de clientes",
      "Relatórios e reativação",
    ],
  },
  {
    id: "max",
    role: "+ WhatsApp automático",
    pitch: "A gestão completa respondendo e agindo sozinha no WhatsApp.",
    features: [
      "Tudo do Pro",
      "Integração com WhatsApp",
      "Mensagens automáticas",
    ],
  },
];

const OBJECTIONS: {
  title: string;
  answer: string;
  /** Destino opcional depois da resposta — só onde a dúvida tem página própria. */
  link?: { label: string; href: string };
}[] = [
  {
    title: "Isso é só agenda com nome bonito de IA?",
    answer:
      "Não. Além da agenda, o Zulan cuida do caixa, das comissões, do estoque e das clientes — e já identifica sozinho quem faltou, cancelou ou sumiu, entregando pronto pra chamar de volta no WhatsApp.",
  },
  {
    title: "Minha cliente vai conseguir usar?",
    answer:
      "Funciona no navegador do celular, sem instalar nada. A cliente clica no link e agenda em menos de 1 minuto — sem cadastro complicado.",
  },
  {
    title: "É complicado de configurar?",
    answer:
      "Em 2 minutos você cadastra o salão, adiciona serviços e já tem seu link compartilhável. Nenhuma integração técnica, nenhum arquivo para instalar.",
  },
  {
    title: "Funciona para barbearia também?",
    answer:
      "Sim. O sistema tem temas e lógica específica para salão feminino, barbearia, estética e negócios mistos. Para barbearia existe até uma página só sobre isso.",
    // Quem faz esta pergunta é exatamente quem a /barbearia atende: é o
    // momento de maior intenção da página inteira pra esse público.
    link: { label: "Ver o Zulan para barbearia", href: "/barbearia" },
  },
  {
    title: "Meus dados ficam seguros?",
    answer:
      "Servidor com criptografia SSL, backups automáticos diários e conformidade com a LGPD. Seus dados e os das clientes protegidos por padrão.",
  },
  {
    title: "E se eu precisar de ajuda?",
    answer:
      "Suporte por WhatsApp e central de ajuda com tutoriais em vídeo. Você não fica sozinha em nenhum momento do processo.",
  },
  {
    title: "Tem contrato de fidelidade?",
    answer:
      "Não. Plano mensal, cancele quando quiser sem multa. Você continua porque quer — não porque é obrigada.",
  },
];

// Depoimentos REAIS apenas — nome, negócio e nota só entram com pessoa de
// verdade e permissão. Enquanto estiver vazio, a seção não aparece (evita
// publicar review inventado, que é propaganda enganosa). Assim que os
// primeiros clientes derem retorno, é só adicionar aqui que a seção volta.
const TESTIMONIALS: {
  name: string;
  role: string;
  initials: string;
  text: string;
  stars: number;
}[] = [];

// ── Dados estruturados (JSON-LD) p/ rich results do Google ──────────────────

function StructuredData() {
  const offers = SUBSCRIBABLE_PLANS.map((p) => ({
    "@type": "Offer",
    name: `Plano ${p.name}`,
    price: p.value.toFixed(2),
    priceCurrency: "BRL",
    url: `${SITE_URL}/criar-salao`,
    availability: "https://schema.org/InStock",
  }));

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Zulan",
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
        description:
          "Equipe virtual com inteligência artificial para salões de beleza, barbearias e clínicas de estética: agenda, recupera clientes e fecha caixa 24 horas por dia.",
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Zulan",
        inLanguage: "pt-BR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Zulan",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        url: SITE_URL,
        inLanguage: "pt-BR",
        description:
          "Sistema de agendamento online com IA para salões de beleza, barbearias e estética: link de agendamento para clientes, recuperação automática de clientes, comissões, caixa, estoque e relatórios.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "BRL",
          lowPrice: Math.min(...SUBSCRIBABLE_PLANS.map((p) => p.value)).toFixed(2),
          highPrice: Math.max(...SUBSCRIBABLE_PLANS.map((p) => p.value)).toFixed(2),
          offerCount: offers.length,
          offers,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: OBJECTIONS.map((o) => ({
          "@type": "Question",
          name: o.title,
          acceptedAnswer: { "@type": "Answer", text: o.answer },
        })),
      },
    ],
  };

  return <JsonLd data={graph} />;
}

// ── CTA fixo no rodapé (mobile) ─────────────────────────────────────────────

function StickyMobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md p-3 sm:hidden">
      <Link href="/criar-salao" className="zl-btn zl-btn-dark w-full">
        Criar meu salão <ArrowRight className="h-4 w-4" weight="bold" />
      </Link>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

const NICHES = [
  {
    img: "/nicho-salao.jpg",
    alt: "Cabeleireira escovando o cabelo de uma cliente sorridente num salão de beleza claro",
    title: "Para salão de beleza",
    services: "Cabelo, unhas, estética e sobrancelha",
    demo: "/demo/salao",
    page: null,
  },
  {
    img: "/nicho-barbearia.jpg",
    alt: "Barbeiro aparando a barba de um cliente numa cadeira de couro, numa barbearia de tijolinho",
    title: "Para barbearia",
    services: "Corte, barba e o clima da sua cadeira",
    demo: "/demo/barbearia",
    // Quem se reconhece aqui ganha também a página que fala a língua dele.
    page: { label: "Página para barbearias", href: "/barbearia" },
  },
] as const;

const STEPS = [
  {
    title: "Cadastre o salão",
    text: "Serviços, preços, duração e equipe. Em 2 minutos o salão está no ar.",
  },
  {
    title: "Compartilhe seu link",
    text: "No WhatsApp, no Instagram, na bio. A cliente escolhe serviço, profissional e horário livre.",
  },
  {
    title: "Atenda. O resto anda.",
    text: "Confirmação, lembrete, caixa e comissão acontecem enquanto você está na cadeira.",
  },
];

export default function Home() {
  return (
    <div className={`zl ${figtree.variable} flex flex-col min-h-full overflow-x-clip pb-20 sm:pb-0`}>
      <StructuredData />

      <SiteHeader />

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <Hero />

        {/* ── SALÃO E BARBEARIA ────────────────────────────────────────── */}
        {/* Links da demo com prefetch={false} de propósito: /demo/[vertical] é
            uma rota que faz login; o prefetch dispararia o login sem clique. */}
        <section aria-labelledby="nichos-titulo" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 id="nichos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] max-w-2xl text-balance">
              Feito para o salão. Feito para a barbearia.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl">
              Tema, serviços e linguagem se ajustam ao seu negócio. Escolha o seu
              e entre num painel de demonstração já funcionando.
            </p>

            <div className="mt-10 grid md:grid-cols-2 gap-5">
              {NICHES.map((n) => (
                <div key={n.title}>
                  <Link
                    href={n.demo}
                    prefetch={false}
                    className="group relative block overflow-hidden rounded-[var(--radius-media)] aspect-[4/5] sm:aspect-[4/3] bg-secondary"
                  >
                    <Image
                      src={n.img}
                      alt={n.alt}
                      fill
                      sizes="(max-width: 768px) 92vw, 620px"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(13,16,20,.78), rgba(13,16,20,.05) 55%)" }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between text-white">
                      <div>
                        <p className="font-display font-extrabold text-2xl sm:text-3xl tracking-[-0.02em]">{n.title}</p>
                        <p className="mt-1 text-white/80">{n.services}</p>
                      </div>
                      <span className="zl-btn zl-btn-light zl-btn-sm shrink-0">
                        Ver demonstração <ArrowRight className="h-4 w-4" weight="bold" />
                      </span>
                    </div>
                  </Link>
                  {n.page && (
                    <Link
                      href={n.page.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
                    >
                      {n.page.label} <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── GESTÃO COMPLETA (explorador de módulos) ──────────────────── */}
        <section id="funcionalidades" aria-labelledby="modulos-titulo" className="py-16 sm:py-24 bg-secondary scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-6 items-end mb-10 sm:mb-14">
              <h2 id="modulos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-balance">
                Tudo o que o salão precisa. Num sistema só.
              </h2>
              <p className="text-lg text-muted-foreground lg:max-w-md lg:justify-self-end">
                Da marcação ao fechamento do caixa: cada parte do dia a dia tem
                seu lugar, e todas conversam entre si.
              </p>
            </div>
            <BenefitsQA />
          </div>
        </section>

        {/* ── COMO FUNCIONA ────────────────────────────────────────────── */}
        <section id="como-funciona" aria-labelledby="passos-titulo" className="py-16 sm:py-24 scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-12 lg:gap-20 items-center">
            <div>
              <h2 id="passos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-balance">
                Do cadastro à agenda cheia em três passos.
              </h2>
              <ol className="mt-10 space-y-8">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="grid grid-cols-[2.75rem_1fr] gap-5">
                    <span className="grid place-items-center h-11 w-11 rounded-full bg-foreground text-background font-display font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display font-bold text-xl tracking-[-0.01em]">{s.title}</h3>
                      <p className="mt-1.5 text-muted-foreground leading-relaxed max-w-md">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="relative mx-auto w-full max-w-[340px]">
              <div className="rounded-[2.6rem] bg-[#0d1014] p-2.5 shadow-[var(--shadow-media)]">
                <div className="relative overflow-hidden rounded-[2.1rem] bg-white" style={{ aspectRatio: "390 / 800" }}>
                  <Image
                    src="/showcase-booking.png"
                    alt="Link de agendamento do salão aberto no celular da cliente"
                    fill
                    sizes="340px"
                    className="object-cover object-top"
                  />
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                O que a sua cliente vê ao abrir o seu link.
              </p>
            </div>
          </div>
        </section>

        {/* ── DEMONSTRAÇÃO ─────────────────────────────────────────────── */}
        <section id="demo" aria-labelledby="demo-titulo" className="scroll-mt-16 px-3 sm:px-5">
          <div className="mx-auto max-w-7xl rounded-[2rem] bg-[var(--ink-band)] text-white px-6 py-16 sm:px-14 sm:py-20 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-center">
            <div>
              <h2 id="demo-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-balance">
                Entre num salão de verdade. Sem cadastro.
              </h2>
              <p className="mt-4 text-lg text-white/75 max-w-xl leading-relaxed">
                Um painel de demonstração com agenda, caixa e comissões já
                rodando, com dados de exemplo. Explore como se fosse seu.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 lg:items-start xl:justify-end">
              <Link href="/demo/salao" prefetch={false} className="zl-btn zl-btn-light">
                Entrar como salão <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>
              <Link href="/demo/barbearia" prefetch={false} className="zl-btn zl-btn-ghost-light">
                Entrar como barbearia <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── PLANOS ───────────────────────────────────────────────────── */}
        <section id="planos" aria-labelledby="planos-titulo" className="py-16 sm:py-24 scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <h2 id="planos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em]">
                Planos simples. Sem fidelidade.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Mensal, sem cartão para testar, cancele quando quiser.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PLAN_CARDS.map((card) => {
                const plan = PLANS[card.id];
                const soon = !!plan.comingSoon;
                return (
                  <div
                    key={plan.id}
                    className="flex flex-col rounded-[var(--radius-media)] border border-border bg-card p-7"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{plan.name}</h3>
                      {soon && (
                        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--brand)]">{card.role}</p>
                    <p className="mt-3 text-muted-foreground min-h-[3rem]">{card.pitch}</p>

                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-extrabold tracking-[-0.03em] tabular-nums">
                        {priceLabel(plan.value)}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                    </p>

                    <ul className="mt-6 space-y-3 flex-1 border-t border-border pt-6">
                      {card.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" weight="bold" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8">
                      {soon ? (
                        <span aria-disabled className="zl-btn w-full bg-secondary text-muted-foreground cursor-not-allowed">
                          Em breve
                        </span>
                      ) : (
                        // Leva o plano escolhido pelo funil inteiro: quem clicou
                        // aqui já decidiu, e cai no checkout com ele marcado.
                        <Link
                          href={`/criar-salao?plano=${plan.id}`}
                          className={`zl-btn w-full ${card.id === "pro" ? "zl-btn-dark" : "zl-btn-line"}`}
                        >
                          Criar meu salão
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── DEPOIMENTOS ──────────────────────────────────────────────── */}
        {/* Só renderiza com depoimentos reais cadastrados (ver TESTIMONIALS). */}
        {TESTIMONIALS.length > 0 && (
          <section aria-labelledby="depoimentos-titulo" className="py-16 sm:py-24 bg-secondary/60">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <h2 id="depoimentos-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em]">
                Quem usa, conta.
              </h2>
              <div className="mt-10 grid md:grid-cols-3 gap-5">
                {TESTIMONIALS.map((t) => (
                  <figure key={t.name} className="rounded-[var(--radius-media)] bg-card p-7 flex flex-col gap-5">
                    <div className="flex gap-0.5" aria-label={`${t.stars} de 5 estrelas`}>
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} weight="fill" className="h-4 w-4 text-[#f5a524]" />
                      ))}
                    </div>
                    <blockquote className="flex-1 text-lg leading-relaxed">{t.text}</blockquote>
                    <figcaption className="flex items-center gap-3">
                      <span className="grid place-items-center h-10 w-10 rounded-full bg-foreground text-background font-bold text-sm">
                        {t.initials}
                      </span>
                      <span>
                        <span className="block font-semibold">{t.name}</span>
                        <span className="block text-sm text-muted-foreground">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── DÚVIDAS ──────────────────────────────────────────────────── */}
        <section id="duvidas" aria-labelledby="duvidas-titulo" className="py-16 sm:py-24 border-t border-border">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-20">
            <div>
              <h2 id="duvidas-titulo" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em]">
                Perguntas frequentes
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-sm">
                Não achou a sua? Fale com a gente pelo WhatsApp de suporte.
              </p>
            </div>
            <div className="border-t border-border">
              {OBJECTIONS.map((o) => (
                <details key={o.title} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-lg font-bold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                    {o.title}
                    <Plus className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-45" weight="bold" />
                  </summary>
                  <div className="pb-6 -mt-1 max-w-[62ch]">
                    <p className="text-muted-foreground leading-relaxed">{o.answer}</p>
                    {o.link && (
                      <Link
                        href={o.link.href}
                        className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[var(--brand)] hover:underline"
                      >
                        {o.link.label} <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── FECHAMENTO ───────────────────────────────────────────────── */}
        <section aria-labelledby="fim-titulo" className="pb-20 sm:pb-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="rounded-[2rem] bg-secondary px-6 py-14 sm:px-14 sm:py-20 text-center">
              <h2 id="fim-titulo" className="mx-auto max-w-3xl font-display font-extrabold text-3xl sm:text-6xl tracking-[-0.035em] text-balance">
                Seu salão inteiro, num lugar só. A partir de hoje.
              </h2>
              <p className="mt-5 text-lg text-muted-foreground">
                Sem cartão para testar · Cancele quando quiser
              </p>
              <div className="mt-9 flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/criar-salao" className="zl-btn zl-btn-dark">
                  Criar meu salão <ArrowRight className="h-4 w-4" weight="bold" />
                </Link>
                <a href="#demo" className="zl-btn zl-btn-line">
                  Ver a demonstração
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <StickyMobileCTA />
    </div>
  );
}
