/**
 * Compressão/redimensionamento de imagem no navegador (para avatares e logos).
 *
 * Fotos grandes de celular (5–12MB) viram ~50–150KB, o que evita limites de
 * upload e deixa a imagem leve. Lança erro se a imagem não decodificar (ex.:
 * formatos não suportados pelo navegador).
 *
 * Reaproveitado por várias telas (foto de profissional, foto de cliente,
 * logo do salão, galeria) — antes havia uma cópia em cada uma.
 */
export async function compressImage(
  file: File,
  { maxDim = 512, quality = 0.85, type = "image/jpeg" }: {
    maxDim?: number;
    quality?: number;
    type?: "image/jpeg" | "image/webp";
  } = {},
): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read_failed"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode_failed"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
      type,
      quality,
    );
  });
}
