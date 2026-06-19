"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PhotoResult = { url: string } | { error: string };

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB (já chega comprimida do cliente)

/**
 * Confirma que o usuário logado é dono/gerente do salão e que o membro
 * pertence a esse salão. Retorna ok ou um erro.
 */
async function assertCanManageMember(
  salonId: string,
  memberId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "Não autenticado." };

  const { data: me } = await supabase
    .from("salon_members")
    .select("role")
    .eq("salon_id", salonId)
    .eq("profile_id", uid)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "manager")) {
    return { error: "Sem permissão para editar a equipe." };
  }

  const { data: target } = await supabase
    .from("salon_members")
    .select("id")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (!target) return { error: "Profissional não encontrado." };

  return { ok: true };
}

/**
 * Sobe a foto do profissional via servidor (admin client, ignora RLS) e grava
 * em salon_members.photo_url. O upload do navegador chega ao Storage como
 * anônimo e é barrado pela RLS — por isso vai pelo servidor (mesmo padrão da logo).
 */
export async function uploadMemberPhoto(
  salonId: string,
  memberId: string,
  form: FormData,
): Promise<PhotoResult> {
  const auth = await assertCanManageMember(salonId, memberId);
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
    const path = `avatars/${memberId}.jpg`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const up = await admin.storage
      .from("logos")
      .upload(path, bytes, { upsert: true, contentType: "image/jpeg" });
    if (up.error) return { error: up.error.message };

    const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error } = await admin
      .from("salon_members")
      .update({ photo_url: url })
      .eq("id", memberId);
    if (error) return { error: error.message };

    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro no envio da foto." };
  }
}

/** Remove a foto do profissional (zera photo_url). */
export async function removeMemberPhoto(
  salonId: string,
  memberId: string,
): Promise<PhotoResult> {
  const auth = await assertCanManageMember(salonId, memberId);
  if ("error" in auth) return auth;

  try {
    const admin = createAdminClient();
    await admin.storage.from("logos").remove([`avatars/${memberId}.jpg`]);
    const { error } = await admin
      .from("salon_members")
      .update({ photo_url: null })
      .eq("id", memberId);
    if (error) return { error: error.message };
    return { url: "" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover a foto." };
  }
}
