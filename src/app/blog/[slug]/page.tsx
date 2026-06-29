import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Tag } from "@phosphor-icons/react/dist/ssr";
import { getAllPosts, getPost, formatPostDate } from "@/lib/blog/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Blog Zulan`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      url: `/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Zulan" },
    publisher: { "@type": "Organization", name: "Zulan" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-full bg-background text-foreground">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 md:py-16">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao blog
          </Link>

          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 font-medium">
                <Tag className="h-3 w-3" /> {post.category}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {post.readMinutes} min de leitura
              </span>
              <span>{formatPostDate(post.date)}</span>
            </div>

            <h1 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              {post.title}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>
          </header>

          <hr className="my-8 border-border" />

          <article className="space-y-6 text-[15px] leading-relaxed text-foreground/90">
            {post.sections.map((section, i) => (
              <section key={i} className="space-y-3">
                {section.heading && (
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs?.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc pl-5 space-y-1.5">
                    {section.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>

          <div className="mt-12 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-medium text-foreground">
              Pronto para lotar a agenda?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie seu perfil no Zulan gratuitamente e receba agendamentos 24
              horas por dia.
            </p>
            <Link
              href="/criar-salao"
              className="mt-3 inline-flex items-center rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Começar grátis
            </Link>
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Ver todos os artigos
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
