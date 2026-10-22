import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getJwks } from "@/lib/supabase/jwks";
import type { Tables, Enums } from "@/lib/database.types";

export type Salon = Tables<"salons">;
export type Member = Tables<"salon_members">;
export type Role = Enums<"member_role">;

export type MembershipWithSalon = Member & { salons: Salon };

/**
 * Salões em que o usuário logado é membro ativo (com dados do salão).
 *
 * Memoizado por request (React cache) — layout + página compartilham a mesma
 * chamada, em vez de repeti-las.
 *
 * Usa `getClaims()` em vez de `getUser()`: o middleware (proxy.ts) já valida e
 * renova a sessão a cada request, então aqui podemos ler o JWT *localmente* —
 * sem mais uma ida de rede ao servidor de auth do Supabase a cada navegação.
 *
 * A JWKS é passada de fora ([[getJwks]]) porque o cache que a biblioteca tem é
 * por INSTÂNCIA de cliente, e no servidor nasce um cliente por request: sem
 * isto, "verificação local" buscava as chaves pela rede toda vez — trocava uma
 * ida de rede por outra em vez de eliminá-la.
 */
export const getMyMemberships = cache(
  async (): Promise<MembershipWithSalon[]> => {
    const supabase = await createClient();
    const jwks = await getJwks();
    const { data: claimsData } = await supabase.auth.getClaims(
      undefined,
      jwks ? { jwks } : undefined,
    );
    const userId = claimsData?.claims?.sub;
    if (!userId) return [];

    const { data } = await supabase
      .from("salon_members")
      .select("*, salons(*)")
      .eq("profile_id", userId)
      .eq("is_active", true);

    return (data as MembershipWithSalon[] | null) ?? [];
  },
);

/** Membership ativa de um salão específico (por slug) para o usuário logado. */
export const getMembershipBySlug = cache(
  async (slug: string): Promise<MembershipWithSalon | null> => {
    const memberships = await getMyMemberships();
    return memberships.find((m) => m.salons?.slug === slug) ?? null;
  },
);

/**
 * Catálogo de permissões (tabela global, muda só por migration), guardado no
 * escopo do módulo por alguns minutos: era uma ida ao banco a cada clique no
 * painel para trazer sempre a mesma lista. Lista vazia não entra no cache —
 * pode ser falha momentânea, e dono sem permissão nenhuma é pior que uma busca.
 */
const PERMISSOES_TTL_MS = 10 * 60 * 1000;
let permissoesCache: { keys: string[]; em: number } | null = null;

async function getPermissionKeys(): Promise<string[]> {
  if (permissoesCache && Date.now() - permissoesCache.em < PERMISSOES_TTL_MS) {
    return permissoesCache.keys;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("permissions").select("key");
  const keys = (data ?? []).map((p) => p.key);
  if (keys.length) permissoesCache = { keys, em: Date.now() };
  return keys;
}

/**
 * Conjunto de permissões efetivas do membro num salão.
 * Owner recebe todas. Demais: padrão do cargo + overrides do membro.
 */
export const getEffectivePermissions = cache(async function (
  salonId: string,
  member: Member,
): Promise<Set<string>> {
  const supabase = await createClient();

  if (member.role === "owner") return new Set(await getPermissionKeys());

  // 1) defaults globais do cargo  2) ajuste por cargo do salão  3) override por pessoa
  const [{ data: roleDefaults }, { data: salonRole }, { data: overrides }] = await Promise.all([
    supabase.from("role_permissions").select("permission_key, allowed").eq("role", member.role),
    supabase
      .from("salon_role_permissions")
      .select("permission_key, allowed")
      .eq("salon_id", salonId)
      .eq("role", member.role),
    supabase.from("member_permissions").select("permission_key, allowed").eq("member_id", member.id),
  ]);

  const effective = new Set<string>();
  for (const rd of roleDefaults ?? []) {
    if (rd.allowed) effective.add(rd.permission_key);
  }
  for (const sr of salonRole ?? []) {
    if (sr.allowed) effective.add(sr.permission_key);
    else effective.delete(sr.permission_key);
  }
  for (const ov of overrides ?? []) {
    if (ov.allowed) effective.add(ov.permission_key);
    else effective.delete(ov.permission_key);
  }
  return effective;
});
