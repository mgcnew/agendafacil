"use server";

import { lookupCep, type CepLookup } from "@/lib/cep";

/**
 * Busca o CEP no servidor (evita CORS e reaproveita o cache do fetch).
 * A tela usa isso pra autopreencher rua/bairro/cidade/UF e a coordenada.
 */
export async function lookupCepAction(cep: string): Promise<CepLookup | null> {
  return lookupCep(cep);
}
