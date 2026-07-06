"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/salon";

export type PhotoResult = { url: string } | { error: string };

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB (já chega comprimida do cliente)

/**
 * Confirma que o usuário logado gerencia clientes (permissão clients.manage)
 * nesse salão e que o cliente pertence a ele. Mesmo modelo de permissão da
 * ficha do cliente (canManage em clientes/[id]/page.tsx).
 */
async function assertCanManageClient(
  salonId: string,
  clientId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "Não autenticado." };

  const { data: me } = await supabase
    .from("salon_members")
    .select("*")
    .eq("salon_id", salonId)
    .eq("profile_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!me) return { error: "Sem acesso a este salão." };

  const perms = await getEffectivePermissions(salonId, me);
  if (!perms.has("clients.manage")) {
    return { error: "Sem permissão para editar clientes." };
  }

  const { data: target } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (!target) return { error: "Cliente não encontrado." };

  return { ok: true };
}

/**
 * Sobe a foto do cliente via servidor (admin client, ignora RLS) e grava em
 * clients.photo_url. O upload do navegador chega ao Storage como anônimo e é
 * barrado pela RLS — por isso vai pelo servidor (mesmo padrão da foto de membro).
 */
export async function uploadClientPhoto(
  salonId: string,
  clientId: string,
  form: FormData,
): Promise<PhotoResult> {
  const auth = await assertCanManageClient(salonId, clientId);
  if ("error" in auth) return auth;

  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido." };
  if (!file.type.startsWith("image/")) {
    return { error: "Selecione um arquivo de imagem (PNG, JPG…)." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Imagem muito grande." };
  }

  try {
    const admin = createAdminClient();
    const path = `client_avatars/${clientId}.jpg`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const up = await admin.storage
      .from("logos")
      .upload(path, bytes, { upsert: true, contentType: "image/jpeg" });
    if (up.error) return { error: up.error.message };

    const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error } = await admin
      .from("clients")
      .update({ photo_url: url })
      .eq("id", clientId);
    if (error) return { error: error.message };

    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro no envio da foto." };
  }
}

/** Remove a foto do cliente (zera photo_url). */
export async function removeClientPhoto(
  salonId: string,
  clientId: string,
): Promise<PhotoResult> {
  const auth = await assertCanManageClient(salonId, clientId);
  if ("error" in auth) return auth;

  try {
    const admin = createAdminClient();
    await admin.storage.from("logos").remove([`client_avatars/${clientId}.jpg`]);
    const { error } = await admin
      .from("clients")
      .update({ photo_url: null })
      .eq("id", clientId);
    if (error) return { error: error.message };
    return { url: "" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover a foto." };
  }
}
