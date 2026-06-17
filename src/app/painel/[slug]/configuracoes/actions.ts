"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type LogoResult = { url: string } | { error: string };

const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3 MB

/** Confirma que o usuário logado é o dono do salão. Retorna o id do salão. */
async function assertOwner(
  slug: string,
): Promise<{ salonId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "Não autenticado." };

  const { data: salon } = await supabase
    .from("salons")
    .select("id, owner_id")
    .eq("slug", slug)
    .single();
  if (!salon || salon.owner_id !== uid) {
    return { error: "Apenas o dono do salão pode alterar a logo." };
  }
  return { salonId: salon.id };
}

/**
 * Faz upload da logo via servidor (admin client, ignora RLS) e grava logo_url.
 * Evita o problema de o upload do navegador chegar ao Storage como anônimo.
 */
export async function uploadLogo(
  slug: string,
  form: FormData,
): Promise<LogoResult> {
  const auth = await assertOwner(slug);
  if ("error" in auth) return auth;

  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido." };
  if (!file.type.startsWith("image/")) {
    return { error: "Selecione um arquivo de imagem (PNG, JPG…)." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Imagem muito grande. Máximo 3 MB." };
  }

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${auth.salonId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const up = await admin.storage
    .from("logos")
    .upload(path, bytes, { upsert: true, contentType: file.type });
  if (up.error) return { error: up.error.message };

  const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await admin
    .from("salons")
    .update({ logo_url: url })
    .eq("id", auth.salonId);
  if (error) return { error: error.message };

  return { url };
}

/** Remove a logo (zera logo_url). */
export async function removeLogo(slug: string): Promise<LogoResult> {
  const auth = await assertOwner(slug);
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("salons")
    .update({ logo_url: null })
    .eq("id", auth.salonId);
  if (error) return { error: error.message };

  return { url: "" };
}
