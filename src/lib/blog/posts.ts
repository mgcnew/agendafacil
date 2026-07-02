// Conteúdo do blog — armazenado na tabela `blog_posts` (Supabase), editável
// pelo dono da plataforma na aba Blog do painel admin. O corpo de cada post
// é Markdown-lite (ver parse.ts) e vira `sections` na hora de renderizar.
//
// Server-only (usa o client Supabase de servidor) — não importar deste
// arquivo a partir de "use client" components. Para o tipo Post e
// formatPostDate, importe de "@/lib/blog/types".

import { createClient } from "@/lib/supabase/server";
import { parsePostBody } from "./parse";
import type { Post } from "./types";

export type { Post, PostSection } from "./types";
export { formatPostDate } from "./types";

type BlogPostRow = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  body: string;
  read_minutes: number;
  published_at: string;
};

function rowToPost(row: BlogPostRow): Post {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    date: row.published_at,
    readMinutes: row.read_minutes,
    sections: parsePostBody(row.body),
  };
}

const SELECT_COLS = "slug, title, excerpt, category, body, read_minutes, published_at";

export async function getAllPosts(): Promise<Post[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts" as never)
    .select(SELECT_COLS)
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  return ((data ?? []) as unknown as BlogPostRow[]).map(rowToPost);
}

export type PostSummary = Pick<Post, "slug" | "title" | "excerpt" | "category" | "date" | "readMinutes">;

/** Lista leve (sem body) para blocos de "leia também" etc. */
export async function getPostSummaries(excludeSlug?: string): Promise<PostSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("blog_posts" as never)
    .select("slug, title, excerpt, category, read_minutes, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  if (excludeSlug) query = query.neq("slug", excludeSlug);
  const { data } = await query;
  return ((data ?? []) as unknown as BlogPostRow[]).map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    date: row.published_at,
    readMinutes: row.read_minutes,
  }));
}

export async function getPost(slug: string): Promise<Post | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts" as never)
    .select(SELECT_COLS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data ? rowToPost(data as unknown as BlogPostRow) : undefined;
}
