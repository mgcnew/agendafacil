import {
  CalendarCheck,
  UsersThree,
  Scissors,
  House,
  ChartBar,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Mockup do app e card "ao vivo", compartilhados entre a home e a página de
 * barbearia.
 *
 * Reconstruídos em HTML/CSS em vez de imagem: ficam nítidos em qualquer tela,
 * seguem os tokens da marca automaticamente (inclusive no modo noturno) e o
 * conteúdo muda por prop — a home fala de salão, a /barbearia fala de barbearia,
 * sem duplicar o componente.
 */

export type MockupContent = {
  /** Primeiro nome de quem está logado — é a dona/o dono do negócio. */
  owner: string;
  /** Iniciais do próximo cliente, no avatar. */
  initials: string;
  clientName: string;
  /** Serviço + horário, ex.: "Corte + Barba · hoje 13:00". */
  serviceLine: string;
  date: string;
};

const SALAO: MockupContent = {
  owner: "Juliana",
  initials: "RS",
  clientName: "Rafael Silva",
  serviceLine: "Corte Masculino · hoje 13:00",
  date: "Quinta-feira, 23 de maio",
};

export const BARBEARIA: MockupContent = {
  owner: "Bruno",
  initials: "TM",
  clientName: "Thiago Moura",
  serviceLine: "Corte + Barba · hoje 14:30",
  date: "Quinta-feira, 23 de maio",
};

/** Card "Novo agendamento" chegando ao vivo. */
export function LiveCard({ name = "Ana Paula", detail = "hoje, 14:00 · confirmado" }: {
  name?: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-sm pl-2.5 pr-4 py-2.5 shadow-card">
      <span
        className="grid place-items-center h-10 w-10 rounded-xl shrink-0"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <CalendarCheck className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">Novo agendamento</span>
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping"
              style={{ background: "var(--primary)" }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--primary)" }}
            />
          </span>
        </div>
        <span className="block text-[11px] text-muted-foreground">
          {name} · {detail}
        </span>
      </div>
    </div>
  );
}

/** Home do app no celular. Ocupa 100% da largura do wrapper. */
export function PhoneMockup({ content = SALAO }: { content?: MockupContent }) {
  const atalhos = [
    { icon: CalendarCheck, label: "Novo" },
    { icon: UsersThree, label: "Clientes" },
    { icon: Scissors, label: "Serviços" },
  ];
  const tabs = [House, CalendarCheck, UsersThree, ChartBar];

  return (
    <div className="rounded-[2rem] border border-border bg-card p-2 shadow-card" aria-hidden>
      <div className="overflow-hidden rounded-[1.6rem] bg-background">
        {/* status bar */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
          <span className="text-[9px] font-semibold text-foreground/70">9:41</span>
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
        </div>

        {/* saudação */}
        <div className="px-4 pt-1">
          <p className="text-[13px] font-display font-bold text-foreground">
            Olá, {content.owner} 👋
          </p>
          <p className="text-[9px] text-muted-foreground">{content.date}</p>
        </div>

        {/* próximo agendamento */}
        <div className="px-3 pt-2.5">
          <p className="px-1 pb-1 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            Próximo agendamento
          </p>
          <div className="rounded-xl border border-border bg-card p-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-[10px] font-bold text-primary">
                {content.initials}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[10px] font-semibold text-foreground">
                  {content.clientName}
                </p>
                <p className="text-[8.5px] text-muted-foreground">{content.serviceLine}</p>
              </div>
              {/* Verde do status "confirmado" na agenda real (STATUS_META) */}
              <span className="h-2 w-2 rounded-full" style={{ background: "#10b981" }} />
            </div>
            <button
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold text-primary-foreground"
              style={{ background: "var(--primary)" }}
            >
              Ver detalhes <CaretRight className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        {/* atalhos rápidos */}
        <div className="px-3 pt-2.5">
          <p className="px-1 pb-1 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            Atalhos rápidos
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {atalhos.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-2"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[7.5px] font-medium text-foreground/70">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* tab bar */}
        <div className="mt-2.5 flex items-center justify-around border-t border-border bg-card px-2 py-2">
          {tabs.map((Icon, i) => (
            <Icon
              key={i}
              className={`h-3.5 w-3.5 ${i === 0 ? "text-primary" : "text-foreground/35"}`}
              weight={i === 0 ? "fill" : "regular"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
