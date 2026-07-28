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
  { troca: { label: string; href: string }; assinatura: string }
> = {
  salao: {
    troca: { label: "Para barbearias", href: "/barbearia" },
    assinatura: "Feito para salões de beleza brasileiros 🇧🇷",
  },
  barbearia: {
    troca: { label: "Para salões de beleza", href: "/" },
    assinatura: "Feito para barbearias brasileiras 🇧🇷",
  },
};

/** Links ainda sem destino ficam como "#" — viram <a> em vez de <Link>. */
const SEM_DESTINO = "#";

export function SiteFooter({ vertical = "salao" }: { vertical?: Vertical }) {
  const { troca, assinatura } = POR_VERTICAL[vertical];

  const colunas = [
    {
      title: "Produto",
      links: [
        { label: "Funcionalidades", href: "#funcionalidades" },
        { label: "Planos e preços", href: "#planos" },
        troca,
        { label: "Novidades", href: "/blog" },
      ],
    },
    {
      title: "Empresa",
      links: [
        { label: "Sobre nós", href: SEM_DESTINO },
        { label: "Blog", href: "/blog" },
        { label: "Contato", href: SEM_DESTINO },
        { label: "Parcerias", href: SEM_DESTINO },
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
              Equipe virtual com inteligência artificial para salões de beleza,
              barbearias e clínicas de estética.
            </p>
            <div className="flex gap-3 mt-5">
              <a href={SEM_DESTINO} aria-label="Instagram" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href={SEM_DESTINO} aria-label="Facebook" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
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
