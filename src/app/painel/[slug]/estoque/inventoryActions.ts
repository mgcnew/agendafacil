"use server";

import { createClient } from "@/lib/supabase/server";
import { getMembershipBySlug } from "@/lib/salon";
import { MOVEMENTS_PAGE_SIZE, type Movement } from "./types";

/** Botão "Carregar mais" — busca o próximo lote de movimentações sob demanda,
 * evitando trazer todo o histórico (que cresce sem limite) de uma vez. */
export async function loadMoreMovements(
  slug: string,
  offset: number,
): Promise<{ movements: Movement[]; hasMore: boolean }> {
  const membership = await getMembershipBySlug(slug);
  if (!membership) return { movements: [], hasMore: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select("id, type, quantity, reason, created_at, products(name, unit)")
    .eq("salon_id", membership.salon_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + MOVEMENTS_PAGE_SIZE); // +1 p/ detectar se há mais sem query de contagem

  const rows = (data ?? []) as unknown as Movement[];
  const hasMore = rows.length > MOVEMENTS_PAGE_SIZE;
  return { movements: rows.slice(0, MOVEMENTS_PAGE_SIZE), hasMore };
}
