import type { PostSection } from "./parse";

export type { PostSection };

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO (YYYY-MM-DD)
  readMinutes: number;
  sections: PostSection[];
};

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
