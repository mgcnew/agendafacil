import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Tag } from "@phosphor-icons/react/dist/ssr";
import { getPost, getPostSummaries, formatPostDate, type PostSummary } from "@/lib/blog/posts";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
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
  const post = await getPost(slug);
  if (!post) notFound();

  const others = await getPostSummaries(slug);
  const related = [...others]
    .sort((a, b) => (a.category === post.category ? -1 : 0) - (b.category === post.category ? -1 : 0))
    .slice(0, 3);

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
        <div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-16">
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

          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Leia também
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <RelatedCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          )}

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

function RelatedCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-card"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 font-medium">
          {post.category}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {post.readMinutes} min
        </span>
      </div>
      <h3 className="mt-3 font-display text-base font-semibold leading-snug group-hover:text-primary transition-colors">
        {post.title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
        {post.excerpt}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
        Ler <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
