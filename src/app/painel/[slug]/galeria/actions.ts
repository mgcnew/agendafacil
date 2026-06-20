"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";

export type GalleryUploadResult = { id: string; url: string } | { error: string };
export type GalleryDeleteResult = { ok: true } | { error: string };

const MAX_BYTES = 8 * 1024 * 1024;

type AuthOk = { salonId: string };
type AuthErr = { error: string };

async function assertCanManage(slug: string): Promise<AuthOk | AuthErr> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "Não autenticado." };

  const membership = await getMembershipBySlug(slug);
  if (!membership) return { error: "Salão não encontrado." };

  const perms = await getEffectivePermissions(membership.salon_id, membership);
  if (!perms.has("salon.manage")) return { error: "Sem permissão para gerenciar a galeria." };

  return { salonId: membership.salon_id };
}

export async function uploadGalleryPhoto(
  slug: string,
  form: FormData,
): Promise<GalleryUploadResult> {
  const auth = await assertCanManage(slug);
  if ("error" in auth) return auth;

  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido." };
  if (!file.type.startsWith("image/")) return { error: "Selecione uma imagem." };
  if (file.size > MAX_BYTES) return { error: "Imagem muito grande. Máximo 8 MB." };

  try {
    const admin = createAdminClient();
    const photoId = crypto.randomUUID();
    const ext = file.name.match(/\.(webp|jpg|jpeg|png)$/i)?.[1]?.toLowerCase() ?? "webp";
    const path = `${auth.salonId}/${photoId}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const up = await admin.storage
      .from("gallery")
      .upload(path, bytes, { contentType: file.type });
    if (up.error) return { error: up.error.message };

    const { data: pub } = admin.storage.from("gallery").getPublicUrl(path);

    const { data: maxRow } = await admin
      .from("salon_gallery")
      .select("sort_order")
      .eq("salon_id", auth.salonId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error: dbErr } = await admin
      .from("salon_gallery")
      .insert({
        salon_id: auth.salonId,
        url: pub.publicUrl,
        sort_order: (maxRow?.sort_order ?? -1) + 1,
      })
      .select("id")
      .single();
    if (dbErr || !row) return { error: dbErr?.message ?? "Erro ao salvar." };

    return { id: row.id, url: pub.publicUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro no envio." };
  }
}

export async function deleteGalleryPhoto(
  slug: string,
  photoId: string,
): Promise<GalleryDeleteResult> {
  const auth = await assertCanManage(slug);
  if ("error" in auth) return auth;

  try {
    const admin = createAdminClient();

    const { data: photo } = await admin
      .from("salon_gallery")
      .select("url, salon_id")
      .eq("id", photoId)
      .single();

    if (!photo || photo.salon_id !== auth.salonId) return { error: "Foto não encontrada." };

    await admin.from("salon_gallery").delete().eq("id", photoId);

    // Deriva o path de storage a partir da URL pública
    const urlObj = new URL(photo.url);
    const parts = urlObj.pathname.split("/");
    const storagePath = parts.slice(-2).join("/");
    await admin.storage.from("gallery").remove([storagePath]);

    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover." };
  }
}
