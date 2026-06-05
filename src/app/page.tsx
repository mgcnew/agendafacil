import Link from "next/link";
import { Button } from "@/components/ui";
import { ParallaxHero } from "@/components/landing/ParallaxHero";
import { DevicesShowcase } from "@/components/landing/DevicesShowcase";
import { BenefitsQA } from "@/components/landing/BenefitsQA";
import {
  Scissors,
  Smartphone,
  Zap,
  Check,
  Lock,
  HeartHandshake,
  BadgeCheck,
  Wallet,
  ArrowRight,
  Star,
} from "lucide-react";

// ── Dados ──────────────────────────────────────────────────────────────────

const OBJECTIONS = [
  {
    icon: Smartphone,
    title: "Minha cliente vai conseguir usar?",
    answer:
      "Funciona no navegador do celular, sem instalar nada. A cliente clica no link e agenda em menos de 1 minuto — sem cadastro complicado.",
  },
  {
    icon: Zap,
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
    icon: HeartHandshake,
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
    icon: BadgeCheck,
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

const NAV_LINKS = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Planos", href: "#planos" },
];

const FOOTER_COLS = [
  {
    title: "Produto",
    links: ["Funcionalidades", "Planos e preços", "Novidades", "Roadmap"],
  },
  {
    title: "Empresa",
    links: ["Sobre nós", "Blog", "Contato", "Parcerias"],
  },
  {
    title: "Legal",
    links: ["Política de privacidade", "Termos de uso", "LGPD", "Cookies"],
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
        border: "2.5px solid #f97316",
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
        background: "radial-gradient(circle, #f97316, transparent 70%)",
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
      <polygon points="40,4 76,72 4,72" stroke="#f97316" strokeWidth="3" fill="none" strokeLinejoin="round" />
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
            fill="#f97316"
          />
        )),
      )}
    </svg>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="flex flex-col min-h-full bg-background text-foreground overflow-x-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
              <Scissors className="h-5 w-5" />
            </span>
            AgendeFácil
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/entrar">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link href="/criar-salao">
              <Button size="sm">Teste grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <ParallaxHero />

      {/* ── COMO FUNCIONA — multi-device ──────────────────────────────── */}
      <section id="como-funciona" className="relative bg-background py-20 sm:py-28 overflow-hidden">
        {/* Formas geométricas */}
        <OrangeRing size={360} opacity={0.12} style={{ top: -100, left: -100 }} />
        <OrangeBlob size={280} opacity={0.06} style={{ top: -40, left: -60 }} />
        <OrangeDots cols={6} rows={5} opacity={0.14} style={{ bottom: 40, right: 20 }} />
        <OrangeTriangle size={56} opacity={0.13} rotate={-20} style={{ bottom: 60, left: "45%" }} />

        <div className="mx-auto max-w-6xl px-5 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Texto */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
                Acesse de onde estiver
              </p>
              <h2 className="font-display text-3xl sm:text-4xl leading-tight">
                No computador da recepção,<br className="hidden sm:block" />
                no celular da profissional.
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
                O painel administrativo funciona em qualquer dispositivo — sem instalar app.
                Sua equipe gerencia a agenda no computador e a cliente agenda diretamente
                pelo celular pelo link personalizado do seu salão.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Agenda em tempo real, atualizada para toda a equipe",
                  "Link da cliente funciona em qualquer celular, sem cadastro",
                  "Painel responsivo para tablet e desktop",
                  "Acesso com permissões por cargo — cada um vê o que precisa",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <DevicesShowcase />
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
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#f97316" }}>
              Benefícios reais
            </p>
            <h2 className="font-display text-3xl sm:text-4xl">
              Por que salões escolhem o AgendeFácil?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Clique em cada pergunta para ver a resposta. Cada recurso nasceu de um problema real.
            </p>
          </div>

          <BenefitsQA />
        </div>
      </section>

      {/* ── QUEBRA DE OBJEÇÕES ────────────────────────────────────────── */}
      <section className="relative bg-background py-20 sm:py-28 overflow-hidden">
        {/* Formas geométricas */}
        <OrangeBlob size={400} opacity={0.05} style={{ bottom: -120, right: -100 }} />
        <OrangeRing size={220} opacity={0.13} style={{ bottom: 40, right: 60 }} />
        <OrangeDots cols={4} rows={4} opacity={0.12} style={{ top: 30, left: "50%" }} />

        <div className="mx-auto max-w-6xl px-5 relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
              Sem mistério
            </p>
            <h2 className="font-display text-3xl sm:text-4xl">
              Suas dúvidas respondidas
            </h2>
            <p className="mt-3 text-muted-foreground">
              Antes de começar, é natural ter perguntas. Aqui vão as mais comuns.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {OBJECTIONS.map((o) => (
              <div
                key={o.title}
                className="rounded-[var(--radius)] border border-border bg-card p-6 hover:shadow-card transition-shadow group"
              >
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-secondary text-secondary-foreground mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <o.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-base font-semibold mb-2">{o.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{o.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BANNER TRIAL ─────────────────────────────────────────────── */}
      <section id="planos" className="px-5 py-6">
        <div
          className="relative overflow-hidden mx-auto max-w-6xl rounded-[2rem] px-8 py-16 sm:px-16 sm:py-20"
          style={{
            background: "linear-gradient(135deg, #431407 0%, #7c2d12 55%, #c2410c 100%)",
          }}
        >
          {/* Brilho laranja */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: "-80px",
              left: "40%",
              width: "500px",
              height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(251,146,60,0.22), transparent)",
            }}
          />
          {/* Formas laranja no banner */}
          <OrangeRing size={260} opacity={0.18} style={{ bottom: -80, right: -60 }} />
          <OrangeRing size={160} opacity={0.14} style={{ bottom: 20, right: 80 }} />
          <OrangeBlob size={200} opacity={0.10} style={{ bottom: -60, right: -30 }} />
          <OrangeTriangle size={52} opacity={0.20} rotate={15} style={{ top: 24, right: "35%" }} />
          <OrangeDots cols={4} rows={3} opacity={0.20} style={{ top: 28, right: 28 }} />

          <div className="af-grain absolute inset-0 opacity-[0.07]" aria-hidden />

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-10">
            {/* Texto */}
            <div className="text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-orange-200/80">
                Sem cartão de crédito · Sem compromisso
              </p>
              <h2 className="font-display text-3xl sm:text-5xl text-white leading-tight">
                5 dias grátis.<br className="hidden sm:block" />
                Sem compromisso.
              </h2>
              <p className="mt-4 text-white/75 max-w-lg leading-relaxed">
                Cadastre agora, configure em 2 minutos e veja sua agenda se
                organizar sozinha. Depois você decide se continua — sem pressão.
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <Link href="/criar-salao">
                <Button
                  size="lg"
                  className="bg-white text-neutral-900 hover:bg-white/90 border-transparent font-bold min-w-[220px] text-base"
                >
                  Criar meu salão grátis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <ul className="flex flex-col sm:flex-row gap-x-4 gap-y-1">
                {["Configurado em 2 min", "Cancele quando quiser"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-xs text-white/60">
                    <Check className="h-3 w-3 text-orange-300 shrink-0" /> {t}
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
        {/* Formas geométricas */}
        <OrangeRing size={420} opacity={0.08} style={{ top: -140, left: -100 }} />
        <OrangeDots cols={5} rows={4} opacity={0.12} style={{ bottom: 40, right: 24 }} />
        <OrangeTriangle size={60} opacity={0.11} rotate={-10} style={{ top: 50, right: "30%" }} />

        <div className="mx-auto max-w-6xl px-5 relative">
          <div className="text-center max-w-xl mx-auto mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
              Depoimentos
            </p>
            <h2 className="font-display text-3xl sm:text-4xl">
              Quem usa, não quer mais largar.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-[var(--radius)] border border-border bg-background p-6 flex flex-col gap-4"
              >
                {/* Aspas laranja */}
                <p
                  className="font-display text-5xl leading-none select-none"
                  style={{ color: "#f97316", opacity: 0.35 }}
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
                    style={{ background: "#f97316", color: "#fff" }}
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
        {/* Formas geométricas */}
        <OrangeRing size={300} opacity={0.07} style={{ bottom: -100, left: -60 }} />
        <OrangeDots cols={3} rows={3} opacity={0.10} style={{ top: 24, right: 40 }} />

        <div className="relative mx-auto max-w-6xl px-5 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

            {/* Marca */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
                <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
                  <Scissors className="h-5 w-5" />
                </span>
                AgendeFácil
              </Link>
              <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
                Software de agendamento para salões de beleza, barbearias e
                clínicas de estética.
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
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="relative border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>© 2026 AgendeFácil · Todos os direitos reservados.</p>
            <p>Feito para salões de beleza brasileiros 🇧🇷</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
