import Link from "next/link";
import {
  Scissors,
  CalendarCheck,
  Percent,
  ShieldCheck,
  Boxes,
  Star,
  Check,
} from "lucide-react";

const BENEFITS = [
  { icon: CalendarCheck, text: "A cliente agenda sozinha pelo seu link" },
  { icon: Percent, text: "Comissões e caixa calculados automaticamente" },
  { icon: ShieldCheck, text: "Equipe com permissões sob o seu controle" },
  { icon: Boxes, text: "Estoque com baixa automática por serviço" },
];

const TRUST = [
  "Sem cartão de crédito",
  "Cancele quando quiser",
  "Dados protegidos (LGPD)",
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Painel de marca (desktop) */}
      <div
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12"
        style={{ background: "linear-gradient(150deg, #fafaf8 0%, #fff5eb 100%)" }}
      >
        {/* ── Formas geométricas ─────────────────────────────── */}
        {/* Círculo grande — outline, canto superior direito */}
        <div
          className="absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full pointer-events-none"
          style={{ border: "2px solid rgba(234,88,12,0.13)" }}
          aria-hidden
        />
        {/* Círculo médio — outline, dentro do grande */}
        <div
          className="absolute top-10 right-10 h-64 w-64 rounded-full pointer-events-none"
          style={{ border: "1px solid rgba(234,88,12,0.08)" }}
          aria-hidden
        />
        {/* Mancha difusa — centro esquerda */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -left-20 h-56 w-56 rounded-full pointer-events-none blur-3xl"
          style={{ background: "rgba(251,146,60,0.10)" }}
          aria-hidden
        />
        {/* Quadrado rotacionado grande — inferior direito */}
        <div
          className="absolute bottom-14 right-8 h-32 w-32 rounded-2xl pointer-events-none"
          style={{ border: "1.5px solid rgba(234,88,12,0.10)", transform: "rotate(22deg)" }}
          aria-hidden
        />
        {/* Quadrado preenchido pequeno — próximo ao grande */}
        <div
          className="absolute bottom-32 right-32 h-14 w-14 rounded-xl pointer-events-none"
          style={{ background: "rgba(251,146,60,0.07)", transform: "rotate(10deg)" }}
          aria-hidden
        />
        {/* Grade de pontos — canto inferior esquerdo */}
        <div className="absolute bottom-14 left-12 grid grid-cols-4 gap-2.5 pointer-events-none" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: "rgba(234,88,12,0.20)" }} />
          ))}
        </div>

        {/* Logo */}
        <Link
          href="/"
          className="relative flex items-center gap-2 font-display font-bold text-xl text-foreground"
        >
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
            <Scissors className="h-5 w-5" />
          </span>
          Zulan
        </Link>

        {/* Conteúdo central */}
        <div className="relative max-w-md">
          {/* Prova social */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current text-amber-400" />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              +1.200 salões já organizam a agenda por aqui
            </span>
          </div>

          <h2 className="font-display text-4xl leading-[1.1] text-foreground">
            Tudo o que o seu salão precisa, num só lugar.
          </h2>

          <ul className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <li key={b.text} className="flex items-center gap-3">
                <span className="grid place-items-center h-8 w-8 rounded-lg bg-primary/10 text-primary shrink-0">
                  <b.icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-foreground/80">{b.text}</span>
              </li>
            ))}
          </ul>

          {/* Depoimento */}
          <figure className="mt-9 rounded-2xl border border-border bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <blockquote className="text-sm leading-relaxed text-foreground/75">
              &ldquo;Antes eu passava horas no WhatsApp confirmando horário. Hoje
              as clientes agendam sozinhas e eu só apareço para atender.&rdquo;
            </blockquote>
            <figcaption className="mt-3 flex items-center gap-3">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-primary/15 text-primary text-sm font-bold">
                AP
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Ana Paula Martins</p>
                <p className="text-xs text-muted-foreground">Salão da Ana · São Paulo</p>
              </div>
            </figcaption>
          </figure>
        </div>

        {/* Selos de confiança */}
        <ul className="relative flex flex-wrap gap-x-5 gap-y-2">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Coluna do formulário */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md mx-auto">
          {/* Link de volta ao site — topo da coluna */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-8"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Página inicial
          </Link>

          <Link
            href="/"
            className="lg:hidden flex items-center justify-center gap-2 font-display font-bold text-xl mb-8"
          >
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
              <Scissors className="h-5 w-5" />
            </span>
            Zulan
          </Link>

          <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
          )}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-7 text-sm text-muted-foreground text-center">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
