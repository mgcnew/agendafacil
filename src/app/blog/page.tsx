import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "@phosphor-icons/react/dist/ssr";
import { getAllPosts, formatPostDate } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog — dicas de gestão para salões e barbearias | Zulan",
  description:
    "Conteúdo prático sobre agendamento online, gestão, marketing e recuperação de clientes para salões de beleza, barbearias e estética.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-5 py-10 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>

        <header className="mt-6">
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Blog
          </h1>
          <p className="mt-2 text-muted-foreground max-w-xl">
            Dicas práticas de agendamento, gestão e marketing para encher a
            agenda do seu salão ou barbearia.
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-card"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 font-medium">
                  {p.category}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {p.readMinutes} min
                </span>
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold leading-snug group-hover:text-primary transition-colors">
                {p.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                {p.excerpt}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatPostDate(p.date)}</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  Ler <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
