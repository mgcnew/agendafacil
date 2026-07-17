import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";
import { JsonLd } from "@/components/InlineScript";
import { PLANS, priceLabel, SUBSCRIBABLE_PLANS } from "@/lib/plans";
import { Hero } from "@/components/landing/Hero";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { DevicesShowcase } from "@/components/landing/DevicesShowcase";
import { BenefitsQA } from "@/components/landing/BenefitsQA";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  DeviceMobile,
  Handshake,
  Lightning,
  Lock,
  Prohibit,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Star,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://agendafacil-chi.vercel.app";

// SEO específico da home — sobrescreve o default do layout com foco nas
// buscas que a dona de salão/barbearia faz no Google.
export const metadata: Metadata = {
  title:
    "Sistema de agendamento online com IA para salões de beleza e barbearias",
  description:
    "Zulan é a recepcionista virtual do seu salão: agenda que atende sozinha, confirma horário e recupera cliente que sumiu — 24 horas por dia. Você cuida da beleza, a equipe virtual cuida da agenda, do caixa e do marketing. Teste grátis por 14 dias, sem cartão.",
  alternates: { canonical: "/" },
};

// ── Dados ──────────────────────────────────────────────────────────────────

const PLAN_CARDS: {
  id: "basic" | "pro" | "max";
  highlight?: boolean;
  role: string;
  pitch: string;
  features: string[];
}[] = [
  {
    id: "basic",
    role: "Recepcionista virtual",
    pitch: "Ela atende, agenda e confirma horário — 24 horas por dia.",
    features: [
      "Agenda online ilimitada",
      "Link de agendamento para clientes",
      "Confirmação e lembretes no WhatsApp",
      "Cadastro de clientes, serviços e equipe",
    ],
  },
  {
    id: "pro",
    highlight: true,
    role: "+ Marketing e Financeiro",
    pitch: "Sua equipe cresce: alguém cuidando do caixa e procurando clientes para você.",
    features: [
      "Tudo da Recepcionista",
      "Caixa e comissões automatizados",
      "Controle de estoque",
      "Campanhas e recuperação de clientes",
      "Relatórios e reativação",
    ],
  },
  {
    id: "max",
    role: "+ Automação no WhatsApp",
    pitch: "Toda a equipe, agora respondendo e agindo sozinha no WhatsApp.",
    features: [
      "Tudo da Equipe",
      "Integração com WhatsApp",
      "Mensagens automáticas",
    ],
  },
];

const OBJECTIONS = [
  {
    icon: Sparkle,
    title: "Isso é só agenda com nome bonito de IA?",
    answer:
      "Não. Já identificamos sozinhos quem faltou, cancelou ou sumiu e entregamos pronto pra chamar de volta no WhatsApp. É o primeiro passo da equipe virtual.",
  },
  {
    icon: DeviceMobile,
    title: "Minha cliente vai conseguir usar?",
    answer:
      "Funciona no navegador do celular, sem instalar nada. A cliente clica no link e agenda em menos de 1 minuto — sem cadastro complicado.",
  },
  {
    icon: Lightning,
    title: "É complicado de configurar?",
    answer:
      "Em 2 minutos você cadastra o salão, adiciona serviços e já tem seu link compartilhável. Nenhuma integração técnica, nenhum arquivo para instalar.",
  },
  {
    icon: Lock,
    title: "Meus dados ficam seguros?",
    answer:
      "Servidor com criptografia SSL, backups automáticos diários e conformidade com a LGPD. Seus dados e os das clientes protegidos por padrão.",
  },
  {
    icon: Handshake,
    title: "E se eu precisar de ajuda?",
    answer:
      "Suporte por WhatsApp e central de ajuda com tutoriais em vídeo. Você não fica sozinha em nenhum momento do processo.",
  },
  {
    icon: Wallet,
    title: "Tem contrato de fidelidade?",
    answer:
      "Não. Plano mensal, cancele quando quiser sem multa. Você continua porque quer — não porque é obrigada.",
  },
  {
    icon: SealCheck,
    title: "Funciona para barbearia também?",
    answer:
      "Sim. O sistema tem temas e lógica específica para salão feminino, barbearia, estética e negócios mistos.",
  },
];

const TESTIMONIALS = [
  {
    name: "Ana Paula Martins",
    role: "Salão da Ana · São Paulo, SP",
    initials: "AP",
    text: "Antes eu passava horas no WhatsApp confirmando agendamento. Hoje as clientes agendam sozinhas e eu só apareço para atender. Não consigo imaginar sem o sistema.",
    stars: 5,
  },
  {
    name: "Rodrigo Feitosa",
    role: "Barber Kings · Rio de Janeiro, RJ",
    initials: "RF",
    text: "A parte de comissão me salvou. O fechamento do mês que levava duas horas agora é feito em dez minutos. Minha equipe confia mais no processo.",
    stars: 5,
  },
  {
    name: "Carla Souza",
    role: "Espaço Estético Carla · BH, MG",
    initials: "CS",
    text: "Minha cliente mais velha aprendeu a usar o link em cinco minutos. A ficha de anamnese online foi o que me convenceu — é exatamente o que eu precisava.",
    stars: 5,
  },
];

const FOOTER_COLS = [
  {
    title: "Produto",
    links: [
      { label: "Funcionalidades", href: "#funcionalidades" },
      { label: "Planos e preços", href: "#planos" },
      { label: "Novidades", href: "/blog" },
    ],
  },
  {
    title: "Empresa",
    links: ["Sobre nós", { label: "Blog", href: "/blog" }, "Contato", "Parcerias"],
  },
  {
    title: "Legal",
    links: [
      { label: "Política de privacidade", href: "/privacidade" },
      { label: "Termos de uso", href: "/termos" },
      { label: "LGPD", href: "/privacidade" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

// ── Formas geométricas laranja ──────────────────────────────────────────────

/** Anel de círculo — borda laranja fina, apenas decorativo */
function OrangeRing({
  size = 320,
  opacity = 0.18,
  style,
}: {
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="absolute pointer-events-none rounded-full"
      style={{
        width: size,
        height: size,
        border: "2.5px solid #0e6f78",
        opacity,
        ...style,
      }}
    />
  );
}

/** Blob preenchido — círculo laranja suave */
function OrangeBlob({
  size = 200,
  opacity = 0.08,
  style,
}: {
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="absolute pointer-events-none rounded-full"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle, #0e6f78, transparent 70%)",
        opacity,
        ...style,
      }}
    />
  );
}

/** Triângulo decorativo em SVG */
function OrangeTriangle({
  size = 80,
  opacity = 0.15,
  rotate = 0,
  style,
}: {
  size?: number;
  opacity?: number;
  rotate?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className="absolute pointer-events-none"
      style={{ opacity, transform: `rotate(${rotate}deg)`, ...style }}
    >
      <polygon points="40,4 76,72 4,72" stroke="#0e6f78" strokeWidth="3" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

/** Grade de pontos laranja */
function OrangeDots({
  cols = 5,
  rows = 4,
  gap = 18,
  opacity = 0.18,
  style,
}: {
  cols?: number;
  rows?: number;
  gap?: number;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  const w = (cols - 1) * gap;
  const h = (rows - 1) * gap;
  return (
    <svg
      aria-hidden
      width={w + 12}
      height={h + 12}
      className="absolute pointer-events-none"
      style={{ opacity, ...style }}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={6 + c * gap}
            cy={6 + r * gap}
            r={2.5}
            fill="#0e6f78"
          />
        )),
      )}
    </svg>
  );
}

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
          "Equipe virtual com inteligência artificial para salões de beleza, barbearias e clínicas de estética: agenda, recupera clientes, fecha caixa e cuida do marketing 24 horas por dia.",
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

// ── Barra de confiança (stats acima da dobra) ──────────────────────────────

const TRUST_STATS = [
  { icon: Clock, value: "2 min", label: "para configurar o salão" },
  { icon: CalendarCheck, value: "24/7", label: "clientes agendam sozinhas" },
  { icon: ShieldCheck, value: "LGPD", label: "dados protegidos" },
  { icon: Prohibit, value: "0%", label: "fidelidade ou multa" },
];

function TrustBar() {
  return (
    <section
      aria-label="Por que confiar no Zulan"
      className="border-y border-border bg-card"
    >
      <div className="mx-auto max-w-6xl px-5">
        <ul className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
          {TRUST_STATS.map((s, i) => (
            <li
              key={s.label}
              className="group reveal"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-3.5 px-4 py-6 sm:px-6">
                <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-secondary text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="leading-tight">
                  <span className="block font-display text-xl font-bold tracking-tight">
                    {s.value}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {s.label}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── CTA fixo no rodapé (mobile) — alto impacto em conversão ─────────────────

function StickyMobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md p-3 lg:hidden">
      <Link href="/criar-salao" className="block">
        <Button size="lg" className="w-full font-bold">
          Criar meu salão grátis <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="flex flex-col min-h-full bg-background text-foreground overflow-x-clip pb-20 lg:pb-0">
      <StructuredData />
      <ScrollReveal />
      {/* Fallback sem JS: garante que o conteúdo apareça mesmo sem o observador */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <SiteHeader />

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <Hero />

      {/* ── BARRA DE CONFIANÇA ────────────────────────────────────────── */}
      <TrustBar />

      {/* ── COMO FUNCIONA — multi-device ──────────────────────────────── */}
      <section id="como-funciona" className="relative bg-background py-20 sm:py-28 overflow-hidden">
        {/* Atmosfera única e intencional (sem ruído de formas) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -z-0 inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 85% 30%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-6xl px-5 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Texto */}
            <div className="reveal">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                <span className="h-px w-8 bg-primary" />
                Sua equipe, trabalhando enquanto você atende
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.08] tracking-tight">
                Não é mais uma agenda.<br className="hidden sm:block" />{" "}
                <span className="text-primary">É uma equipe que nunca para.</span>
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
                Enquanto você atende quem está na cadeira, o resto do salão
                continua andando — confirmação, cobrança, recuperação de
                cliente e fechamento de caixa, sem você precisar parar.
              </p>

              {/* Capacidades — tabela editorial com etiqueta de contexto */}
              <ul className="mt-8 border-t border-border">
                {[
                  {
                    tag: "Recepção",
                    label: "Agenda que atende sozinha",
                    desc: "A cliente agenda pelo link, recebe confirmação automática e pode remarcar sem te chamar.",
                  },
                  {
                    tag: "Marketing",
                    label: "Clientes que voltam sozinhos",
                    desc: "Quem faltou, cancelou ou sumiu aparece pronto pra chamar no WhatsApp, com mensagem e cupom prontos.",
                  },
                  {
                    tag: "Financeiro",
                    label: "Caixa que se fecha em minutos",
                    desc: "Comissão, vendas e relatório do dia prontos pra baixar — sem planilha.",
                  },
                  {
                    tag: "Equipe",
                    label: "Acesso por cargo",
                    desc: "Cada pessoa enxerga só o que precisa para o trabalho dela.",
                  },
                ].map((c) => (
                  <li
                    key={c.label}
                    className="grid grid-cols-[92px_1fr] sm:grid-cols-[120px_1fr] gap-4 sm:gap-6 py-5 border-b border-border"
                  >
                    <span className="pt-0.5">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{
                          background: "var(--secondary)",
                          color: "var(--primary)",
                        }}
                      >
                        {c.tag}
                      </span>
                    </span>
                    <span>
                      <span className="block font-display font-semibold leading-snug">
                        {c.label}
                      </span>
                      <span className="block text-sm text-muted-foreground mt-1 leading-relaxed">
                        {c.desc}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Device showcase emoldurado */}
            <div className="relative reveal" style={{ transitionDelay: "120ms" }}>
              <div
                aria-hidden
                className="absolute -inset-4 sm:-inset-8 -z-10 rounded-[2.5rem] af-grain"
                style={{
                  background:
                    "linear-gradient(155deg, var(--secondary), transparent 65%)",
                  boxShadow:
                    "inset 0 0 0 1px color-mix(in srgb, var(--primary) 10%, transparent)",
                }}
              />
              <DevicesShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO AO VIVO ──────────────────────────────────────────────── */}
      {/* Links usam <a> puro (não Link) de propósito: /demo/[vertical] é uma
          rota que faz login; o prefetch do Link dispararia o login sem clique. */}
      <section
        id="demo"
        className="px-5 py-16 sm:py-20 border-y border-border"
        style={{ background: "var(--card)" }}
      >
        <div className="mx-auto max-w-3xl text-center reveal">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            <span className="h-px w-8 bg-primary" />
            Sem criar conta
            <span className="h-px w-8 bg-primary" />
          </p>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
            Dê uma volta num salão de verdade
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Entre num painel de demonstração já com agenda, caixa e comissões —
            explore como se fosse seu, sem cadastro. Escolha o tipo do seu negócio:
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <a href="/demo/salao" className="block">
              <Button size="lg" className="w-full sm:w-auto font-semibold">
                Ver demo de salão <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="/demo/barbearia" className="block">
              <Button size="lg" variant="outline" className="w-full sm:w-auto font-semibold">
                Ver demo de barbearia <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Q&A BENEFÍCIOS — INTERATIVO ───────────────────────────────── */}
      <section
        id="funcionalidades"
        className="relative border-y border-border py-20 sm:py-28 overflow-hidden"
        style={{ background: "var(--card)" }}
      >
        {/* Formas geométricas */}
        <OrangeRing size={500} opacity={0.09} style={{ top: -180, right: -160 }} />
        <OrangeBlob size={320} opacity={0.05} style={{ top: -100, right: -100 }} />
        <OrangeDots cols={5} rows={6} opacity={0.13} style={{ bottom: 60, left: 0 }} />
        <OrangeTriangle size={72} opacity={0.12} rotate={30} style={{ top: 40, left: "38%" }} />

        <div className="mx-auto max-w-6xl px-5 relative">
          <div className="max-w-2xl mb-12 sm:mb-16 reveal">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: "#0e6f78" }}>
              <span className="h-px w-8" style={{ background: "#0e6f78" }} />
              Problemas reais, resolvidos
            </p>
            <h2 className="font-display text-3xl sm:text-5xl leading-[1.05] tracking-tight">
              O que tomava seu tempo,<br className="hidden sm:block" />{" "}
              <span className="text-primary">agora roda sozinho.</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-xl">
              Seis dores do dia a dia de um salão — e exatamente como sua
              equipe virtual resolve cada uma.
            </p>
          </div>

          <div className="reveal" style={{ transitionDelay: "100ms" }}>
            <BenefitsQA />
          </div>
        </div>
      </section>

      {/* ── QUEBRA DE OBJEÇÕES / FAQ ──────────────────────────────────── */}
      <section id="duvidas" aria-labelledby="duvidas-titulo" className="relative bg-background py-20 sm:py-28 overflow-hidden">
        {/* Atmosfera única (sem ruído de formas) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "radial-gradient(50% 70% at 50% 100%, color-mix(in srgb, var(--primary) 6%, transparent), transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-5xl px-5 relative">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16 reveal">
            <p className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              <span className="h-px w-8 bg-primary" />
              Sem letra miúda
              <span className="h-px w-8 bg-primary" />
            </p>
            <h2 id="duvidas-titulo" className="font-display text-3xl sm:text-5xl tracking-tight">
              Perguntas frequentes
            </h2>
            <p className="mt-4 text-muted-foreground text-base sm:text-lg">
              Toda dúvida que costuma aparecer antes de começar — respondida sem
              rodeios.
            </p>
          </div>

          {/* Receio → resposta (editorial, sem caixas) */}
          <div className="grid sm:grid-cols-2 gap-x-10 lg:gap-x-14 gap-y-10">
            {OBJECTIONS.map((o, i) => (
              <div
                key={o.title}
                className="group relative pl-5 sm:pl-6 reveal"
                style={{ transitionDelay: `${(i % 2) * 80 + Math.floor(i / 2) * 60}ms` }}
              >
                {/* Trilho de acento */}
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-border transition-colors duration-300 group-hover:bg-primary"
                />

                {/* O receio (a pergunta) */}
                <div className="flex items-start gap-3">
                  <span
                    className="grid place-items-center h-9 w-9 rounded-xl shrink-0 transition-colors duration-300"
                    style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  >
                    <o.icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="font-display text-lg font-semibold leading-snug tracking-tight pt-1">
                    {o.title}
                  </h3>
                </div>

                {/* A resposta */}
                <div className="mt-3 flex items-start gap-2.5">
                  <span
                    className="grid place-items-center h-5 w-5 rounded-full shrink-0 mt-0.5"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {o.answer}
                  </p>
                </div>

                {/* Índice discreto */}
                <span
                  aria-hidden
                  className="absolute -top-1 right-0 font-display text-xs font-bold tabular-nums"
                  style={{ color: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>

          {/* Faixa de garantia — fecha a objeção e empurra pro CTA */}
          <div
            className="mt-14 sm:mt-16 rounded-[1.75rem] px-6 py-8 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left reveal"
            style={{ background: "var(--secondary)" }}
          >
            <div className="flex items-start gap-4">
              <span
                className="hidden sm:grid place-items-center h-12 w-12 rounded-2xl shrink-0"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold tracking-tight">
                  Ainda na dúvida? O risco é zero.
                </p>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  14 dias grátis, sem cartão. Se não for pra você, é só cancelar —
                  sem multa, sem ligação de retenção.
                </p>
              </div>
            </div>
            <Link href="/criar-salao" className="shrink-0">
              <Button size="lg" className="font-semibold whitespace-nowrap">
                Começar grátis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── PLANOS / PREÇOS ──────────────────────────────────────────── */}
      <section id="planos" className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center reveal">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">
              Monte a equipe virtual do seu salão
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Comece com 14 dias grátis. Sem cartão, sem fidelidade — cancele
              quando quiser.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {PLAN_CARDS.map((card, i) => {
              const plan = PLANS[card.id];
              const highlight = card.highlight;
              const soon = !!plan.comingSoon;
              return (
                <div
                  key={plan.id}
                  style={{ transitionDelay: `${i * 80}ms` }}
                  className={[
                    "relative flex flex-col rounded-[var(--radius)] border bg-card p-6 shadow-card reveal",
                    highlight ? "border-primary ring-2 ring-primary/30" : "border-border",
                    soon ? "opacity-80" : "",
                  ].join(" ")}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                      Mais popular
                    </span>
                  )}
                  {soon && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
                      Em breve
                    </span>
                  )}

                  <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                    {card.role}
                  </span>
                  <h3 className="mt-3 font-display text-xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground min-h-[2.5rem]">
                    {card.pitch}
                  </p>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="font-display text-3xl font-bold">
                      {priceLabel(plan.value)}
                    </span>
                    <span className="mb-1 text-sm text-muted-foreground">/mês</span>
                  </div>

                  <ul className="mt-5 space-y-2.5 flex-1">
                    {card.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {soon ? (
                      <Button variant="outline" className="w-full" disabled>
                        Em breve
                      </Button>
                    ) : (
                      <Link href="/criar-salao" className="block">
                        <Button
                          variant={highlight ? "primary" : "outline"}
                          className="w-full"
                        >
                          Começar grátis
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── BANNER TRIAL ─────────────────────────────────────────────── */}
      <section className="px-5 py-6">
        <div
          className="relative overflow-hidden mx-auto max-w-6xl rounded-[2rem] px-8 py-16 sm:px-16 sm:py-20 reveal"
          style={{
            background: "linear-gradient(120deg, #0a565d 0%, #0e6f78 48%, #138a93 100%)",
          }}
        >
          {/* Brilhos suaves — branco + dourado, decorativos */}
          <span
            aria-hidden
            className="absolute pointer-events-none rounded-full"
            style={{ width: 440, height: 440, top: -170, right: -120, background: "radial-gradient(closest-side, rgba(255,255,255,0.20), transparent)" }}
          />
          <span
            aria-hidden
            className="absolute pointer-events-none rounded-full"
            style={{ width: 320, height: 320, bottom: -150, left: -90, background: "radial-gradient(closest-side, rgba(201,162,74,0.45), transparent)" }}
          />
          {/* Anéis brancos sutis */}
          <span
            aria-hidden
            className="absolute pointer-events-none rounded-full"
            style={{ width: 280, height: 280, bottom: -90, right: 50, border: "2px solid rgba(255,255,255,0.18)" }}
          />
          <span
            aria-hidden
            className="absolute pointer-events-none rounded-full"
            style={{ width: 170, height: 170, bottom: 10, right: 110, border: "2px solid rgba(255,255,255,0.14)" }}
          />

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-10">
            {/* Texto */}
            <div className="text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-white/80">
                Sem cartão de crédito · Sem compromisso
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight">
                14 dias grátis.{" "}
                <br className="hidden sm:block" />
                Sem compromisso.
              </h2>
              <p className="mt-4 text-white/90 max-w-lg leading-relaxed">
                Cadastre agora, configure em 2 minutos e veja sua agenda se
                organizar sozinha. Depois você decide se continua — sem pressão.
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <Link href="/criar-salao">
                <Button
                  size="lg"
                  className="bg-white text-[#0a565d] hover:bg-white/90 border-transparent font-bold min-w-[220px] text-base shadow-lg"
                >
                  Criar meu salão grátis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <ul className="flex flex-col sm:flex-row gap-x-4 gap-y-1">
                {["Configurado em 2 min", "Cancele quando quiser"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-xs text-white/80">
                    <Check className="h-3 w-3 text-white shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────── */}
      <section
        className="relative border-t border-border py-20 sm:py-28 overflow-hidden"
        style={{ background: "var(--card)" }}
      >
        {/* Atmosfera única (sem ruído de formas) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 0%, color-mix(in srgb, var(--primary) 6%, transparent), transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-6xl px-5 relative">
          <div className="text-center max-w-xl mx-auto mb-14 reveal">
            <p className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              <span className="h-px w-8 bg-primary" />
              Depoimentos
              <span className="h-px w-8 bg-primary" />
            </p>
            <h2 className="font-display text-3xl sm:text-5xl tracking-tight">
              Quem usa, não quer mais largar.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                style={{ transitionDelay: `${i * 80}ms` }}
                className="rounded-[var(--radius)] border border-border bg-background p-6 flex flex-col gap-4 reveal"
              >
                {/* Aspas laranja */}
                <p
                  className="font-display text-5xl leading-none select-none"
                  style={{ color: "#0e6f78", opacity: 0.35 }}
                >
                  &ldquo;
                </p>

                <p className="text-sm leading-relaxed text-foreground/80 flex-1 -mt-4">
                  {t.text}
                </p>

                {/* Estrelas */}
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-400" />
                  ))}
                </div>

                {/* Autor */}
                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <div
                    className="grid place-items-center h-10 w-10 rounded-full font-display font-bold text-sm shrink-0"
                    style={{ background: "#0e6f78", color: "#fff" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="relative bg-background border-t border-border overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-5 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

            {/* Marca */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center" aria-label="Zulan — página inicial">
                <Image
                  src="/logo-landing.webp"
                  alt="Zulan"
                  width={1396}
                  height={373}
                  className="h-8 w-auto"
                />
              </Link>
              <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
                Equipe virtual com inteligência artificial para salões de
                beleza, barbearias e clínicas de estética.
              </p>
              <div className="flex gap-3 mt-5">
                <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="#" aria-label="Facebook" className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              </div>
            </div>

            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p className="font-semibold text-sm mb-4">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => {
                    const label = typeof l === "string" ? l : l.label;
                    const href = typeof l === "string" ? "#" : l.href;
                    return (
                      <li key={label}>
                        <a href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                          {label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="relative border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>© 2026 Zulan · Todos os direitos reservados.</p>
            <p>Feito para salões de beleza brasileiros 🇧🇷</p>
          </div>
        </div>
      </footer>

      {/* ── CTA FIXO (mobile) ─────────────────────────────────────────── */}
      <StickyMobileCTA />

    </div>
  );
}
