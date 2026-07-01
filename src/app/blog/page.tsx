import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getAllPosts } from "@/lib/blog/posts";
import { BlogList } from "./BlogList";

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
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-16">
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

        <BlogList posts={posts} />
      </div>
    </main>
  );
}
