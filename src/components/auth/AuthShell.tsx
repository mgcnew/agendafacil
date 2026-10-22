import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { figtree } from "@/components/landing/fonts";

/**
 * Moldura das telas de acesso (entrar, criar salão, redefinir senha, convite).
 * Mesmo mundo da landing (.zl): branco, tinta quase-preta, botão-pílula.
 *
 * O lado da marca eram estrelas, "+1.200 salões" e um depoimento que não
 * existem — o PRODUCT.md proíbe prova inventada. Ficaram as duas fotos, salão
 * e barbearia com o mesmo peso, que dizem para quem é sem prometer nada.
 */
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
    <div className={`zl zl-auth ${figtree.variable} min-h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}>
      {/* Coluna do formulário */}
      <div className="flex flex-col min-h-dvh px-5 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between h-16 lg:h-[4.5rem] shrink-0">
          <Link href="/" aria-label="Zulan — página inicial" className="flex items-center">
            <Image
              src="/logo-landing.webp"
              alt="Zulan"
              width={1396}
              height={373}
              priority
              className="h-7 w-auto mix-blend-multiply"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Voltar ao site
          </Link>
        </header>

        <main className="flex-1 flex flex-col justify-center py-10">
          <div className="w-full max-w-[25rem] mx-auto">
            <h1 className="font-display text-[2rem] sm:text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-balance">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2.5 text-[0.95rem] text-muted-foreground text-pretty">{subtitle}</p>
            )}

            <div className="mt-8">{children}</div>

            {footer && (
              <div className="mt-8 pt-6 border-t border-border text-sm text-muted-foreground text-center">
                {footer}
              </div>
            )}
          </div>
        </main>

        <p className="py-6 text-xs text-muted-foreground text-center shrink-0">
          <Link href="/termos" className="hover:text-foreground transition-colors">Termos</Link>
          <span aria-hidden className="mx-2">·</span>
          <Link href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
        </p>
      </div>

      {/* Fotos: salão e barbearia, mesmo peso (desktop) */}
      <aside
        aria-hidden
        className="hidden lg:flex flex-col gap-3 p-3 h-dvh sticky top-0"
      >
        <Foto src="/nicho-salao.jpg" rotulo="Salão de beleza" posicao="50% 30%" />
        <Foto src="/nicho-barbearia.jpg" rotulo="Barbearia" posicao="50% 35%" />
      </aside>
    </div>
  );
}

function Foto({ src, rotulo, posicao }: { src: string; rotulo: string; posicao: string }) {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-[var(--radius-media)] bg-secondary">
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1024px) 52vw, 1px"
        quality={75}
        className="object-cover"
        style={{ objectPosition: posicao }}
      />
      <span className="absolute left-4 bottom-4 rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-semibold text-foreground shadow-[0_2px_8px_rgba(13,16,20,.12)]">
        {rotulo}
      </span>
    </div>
  );
}
