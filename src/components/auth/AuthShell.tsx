import Link from "next/link";
import {
  Scissors,
  CalendarCheck,
  Percent,
  ShieldCheck,
  Boxes,
} from "lucide-react";

const BENEFITS = [
  { icon: CalendarCheck, text: "A cliente agenda sozinha pelo seu link" },
  { icon: Percent, text: "Comissões e caixa calculados automaticamente" },
  { icon: ShieldCheck, text: "Equipe com permissões sob o seu controle" },
  { icon: Boxes, text: "Estoque com baixa automática por serviço" },
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
        style={{ background: "linear-gradient(160deg, #0d564d 0%, #0a3a34 100%)" }}
      >
        <div className="af-grain absolute inset-0 opacity-[0.08]" aria-hidden />
        <div
          className="absolute -top-32 -right-24 h-80 w-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(45,212,191,0.25), transparent)" }}
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-2 font-display font-bold text-xl">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-white/15">
            <Scissors className="h-5 w-5" />
          </span>
          AgendeFácil
        </Link>

        <div className="relative max-w-sm">
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
        </div>

        <p className="relative text-xs uppercase tracking-[0.2em] text-white/45">
          Agenda · Equipe · Comissões · Caixa · Estoque
        </p>
      </div>

      {/* Coluna do formulário */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md mx-auto">
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
          {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-7 text-sm text-muted-foreground text-center">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
