import "server-only";
import { createClient } from "@/lib/supabase/server";
import { instanceNameFor } from "./evolution";

export type WhatsAppContext = {
  salonId: string;
  slug: string;
  instanceName: string;
};

export type GuardResult =
  | { ok: true; ctx: WhatsAppContext }
  | { ok: false; status: number; error: string };

/**
 * Conectar/desconectar o WhatsApp muda o canal que fala com TODOS os clientes
 * do salão — é decisão de dono, não de recepcionista. Por isso restringe a
 * owner/manager, mesmo que a RLS já limite a leitura à equipe.
 */
export async function guardWhatsApp(slug: string): Promise<GuardResult> {
  if (!slug) return { ok: false, status: 400, error: "slug_obrigatorio" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "not_authenticated" };

  const { data: salon } = await supabase
    .from("salons")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!salon) return { ok: false, status: 404, error: "salao_nao_encontrado" };

  const { data: member } = await supabase
    .from("salon_members")
    .select("role")
    .eq("salon_id", salon.id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "owner" && member.role !== "manager")) {
    return { ok: false, status: 403, error: "sem_permissao" };
  }

  return {
    ok: true,
    ctx: { salonId: salon.id, slug: salon.slug, instanceName: instanceNameFor(salon.slug) },
  };
}
