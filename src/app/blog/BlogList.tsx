"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "@phosphor-icons/react/dist/ssr";
import type { Post } from "@/lib/blog/types";
import { formatPostDate } from "@/lib/blog/types";

export function BlogList({ posts }: { posts: Post[] }) {
  const categories = useMemo(
    () => Array.from(new Set(posts.map((p) => p.category))),
    [posts],
  );
  const [active, setActive] = useState<string | null>(null);

  const filtered = active ? posts.filter((p) => p.category === active) : posts;

  return (
    <>
      {categories.length > 1 && (
        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            onClick={() => setActive(null)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
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

        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            Nenhum artigo nessa categoria ainda.
          </p>
        )}
      </div>
    </>
  );
}
