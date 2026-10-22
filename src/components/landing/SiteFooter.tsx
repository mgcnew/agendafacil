import Image from "next/image";
import Link from "next/link";

/**
 * Rodapé da landing, compartilhado entre a home e as páginas por vertical.
 *
 * Além dos links legais (que precisam existir em toda página pública), ele
 * carrega o mesmo desvio de vertical do header: quem chegou pelo Google na
 * página errada tem saída também no fim do scroll, não só no topo.
 */

type Vertical = "salao" | "barbearia";

/** Desvio + assinatura mudam conforme a página onde o rodapé está. */
const POR_VERTICAL: Record<
  Vertical,
  { troca: { label: string; href: string }; demo: string; assinatura: string }
> = {
  salao: {
    troca: { label: "Para barbearias", href: "/barbearia" },
    demo: "/demo/salao",
    assinatura: "Feito para salões de beleza brasileiros 🇧🇷",
  },
  barbearia: {
    troca: { label: "Para salões de beleza", href: "/" },
    demo: "/demo/barbearia",
    assinatura: "Feito para barbearias brasileiras 🇧🇷",
  },
};

export function SiteFooter({ vertical = "salao" }: { vertical?: Vertical }) {
  const { troca, demo, assinatura } = POR_VERTICAL[vertical];

  // "Sobre nós", "Contato", "Parcerias" e os ícones de Instagram/Facebook
  // apontavam para "#": link que não leva a lugar nenhum é pior que nenhum
  // link. Voltam quando existirem as páginas e os perfis de verdade.
  const colunas = [
    {
      title: "Produto",
      links: [
        { label: "Funcionalidades", href: "#funcionalidades" },
        { label: "Planos e preços", href: "#planos" },
        { label: "Ver demonstração", href: demo },
        troca,
      ],
    },
    {
      title: "Zulan",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "Entrar", href: "/entrar" },
        { label: "Criar meu salão", href: "/criar-salao" },
      ],
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

  return (
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
              Gestão completa para salões de beleza e barbearias: agenda,
              clientes, caixa e comissões num lugar só.
            </p>
          </div>

          {colunas.map((col) => (
            <div key={col.title}>
              <p className="font-semibold text-sm mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => {
                  const classe =
                    "text-sm text-muted-foreground hover:text-foreground transition-colors";
                  // Só rota de verdade vira <Link>; âncora e placeholder
                  // continuam <a>, que é o que o Link não aceita bem.
                  const rota = l.href.startsWith("/");
                  return (
                    <li key={l.label}>
                      {rota ? (
                        <Link href={l.href} className={classe}>
                          {l.label}
                        </Link>
                      ) : (
                        <a href={l.href} className={classe}>
                          {l.label}
                        </a>
                      )}
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
          <p>{assinatura}</p>
        </div>
      </div>
    </footer>
  );
}
