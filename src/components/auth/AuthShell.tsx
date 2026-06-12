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
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white"
        style={{
          background:
            "linear-gradient(160deg, #431407 0%, #7c2d12 55%, #c2410c 100%)",
        }}
      >
        <div className="af-grain absolute inset-0 opacity-[0.08]" aria-hidden />
        <div
          className="absolute -top-32 -right-24 h-80 w-80 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,165,4,0.32), transparent)",
          }}
          aria-hidden
        />
        <div
          className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,165,4,0.16), transparent)",
          }}
          aria-hidden
        />

        {/* Logo */}
        <Link
          href="/"
          className="relative flex items-center gap-2 font-display font-bold text-xl"
        >
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-white/15">
            <Scissors className="h-5 w-5" />
          </span>
          AgendeFácil
        </Link>

        {/* Conteúdo central */}
        <div className="relative max-w-md">
          {/* Prova social */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current text-amber-300" />
              ))}
            </div>
            <span className="text-sm text-white/80">
              +1.200 salões já organizam a agenda por aqui
            </span>
          </div>

          <h2 className="font-display text-4xl leading-[1.1]">
            Tudo o que o seu salão precisa, num só lugar.
          </h2>

          <ul className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-white/90">
                <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 shrink-0">
                  <b.icon className="h-4 w-4" />
                </span>
                <span className="text-sm">{b.text}</span>
              </li>
            ))}
          </ul>

          {/* Depoimento */}
          <figure className="mt-9 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
            <blockquote className="text-sm leading-relaxed text-white/90">
              &ldquo;Antes eu passava horas no WhatsApp confirmando horário. Hoje
              as clientes agendam sozinhas e eu só apareço para atender.&rdquo;
            </blockquote>
            <figcaption className="mt-3 flex items-center gap-3">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/20 text-sm font-bold">
                AP
              </span>
              <div>
                <p className="text-sm font-semibold">Ana Paula Martins</p>
                <p className="text-xs text-white/60">Salão da Ana · São Paulo</p>
              </div>
            </figcaption>
          </figure>
        </div>

        {/* Selos de confiança */}
        <ul className="relative flex flex-wrap gap-x-5 gap-y-2">
          {TRUST.map((t) => (
            <li
              key={t}
              className="flex items-center gap-1.5 text-xs text-white/70"
            >
              <Check className="h-3.5 w-3.5 text-orange-200 shrink-0" /> {t}
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
            AgendeFácil
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
