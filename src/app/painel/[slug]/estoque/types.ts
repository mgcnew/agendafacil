export type Movement = {
  id: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string | null;
  created_at: string;
  products: { name: string } | null;
};

/** Tamanho do lote de "Movimentações recentes" — histórico cresce sem limite, então
 * carregamos aos poucos (server-side) em vez de trazer tudo de uma vez. */
export const MOVEMENTS_PAGE_SIZE = 10;
