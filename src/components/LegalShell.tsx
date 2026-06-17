import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Layout compartilhado das páginas legais (Termos, Privacidade, Cookies).
 * Conteúdo é renderizado como server component simples — sem APIs de runtime.
 */
export function LegalShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>

        <h1 className="mt-6 font-display text-3xl md:text-4xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {updatedAt}
        </p>

        <div className="legal-content mt-8 space-y-6 text-[15px] leading-relaxed text-foreground/90">
          {children}
        </div>

        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          AgendeFácil — agendamento para salões e barbearias. Em caso de dúvidas
          sobre este documento, escreva para{" "}
          <a href="mailto:contato@agendefacil.com.br" className="text-primary">
            contato@agendefacil.com.br
          </a>
          .
        </p>
      </div>
    </main>
  );
}

/** Bloco de seção numerada padrão dos documentos legais. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground">
        {heading}
      </h2>
      {children}
    </section>
  );
}
