"use server";

import { lookupCep, type CepLookup } from "@/lib/cep";

/**
 * Consulta de CEP para a página pública de agendamento.
 *
 * Existe separado do action do painel porque são superfícies diferentes: esta
 * roda para visitante anônimo. Não recebe nem devolve nada do salão nem do
 * cliente — entra um CEP, sai um endereço público dos Correios.
 *
 * No servidor e não no navegador por dois motivos: as duas APIs não mandam
 * CORS, e aqui o `fetch` do Next cacheia o resultado por 30 dias (CEP não
 * muda), então o mesmo bairro não vira consulta nova a cada cliente.
 */
export async function lookupCepPublic(cep: string): Promise<CepLookup | null> {
  return lookupCep(cep);
}
