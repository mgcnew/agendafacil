"use client";

import { useRef, useState } from "react";
import NextImage from "next/image";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  CaretLeft,
  CaretRight,
  CircleNotch,
  Images,
  MagnifyingGlassPlus,
  Plus,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { uploadGalleryPhoto, deleteGalleryPhoto } from "./actions";

type Photo = { id: string; url: string; caption: string | null };

/** Comprime para WebP antes de enviar — mesmo padrão do logo/avatar. */
async function compressImage(file: File, maxDim = 1200, quality = 0.85): Promise<File> {
  try {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("decode"));
      i.src = dataUrl;
    });
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

function LightboxModal({
  photos,
  initialIdx,
  onClose,
}: {
  photos: Photo[];
  initialIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const thumbRef = useRef<HTMLDivElement>(null);

  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  // teclado
  useState(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // swipe touch
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchX.current = null;
  };

  const photo = photos[idx];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/60 text-sm">{idx + 1} / {photos.length}</span>
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* imagem principal */}
      <div className="flex-1 flex items-center justify-center relative px-12 min-h-0">
        {photos.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <CaretLeft className="h-6 w-6" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.caption ?? `Foto ${idx + 1}`}
          className="max-h-full max-w-full object-contain rounded-lg select-none af-rise"
        />
        {photos.length > 1 && (
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <CaretRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* miniaturas */}
      {photos.length > 1 && (
        <div
          ref={thumbRef}
          className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3 shrink-0 justify-center"
        >
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIdx(i)}
              className={cn(
                "relative shrink-0 h-14 w-20 rounded-md overflow-hidden border-2 transition",
                i === idx ? "border-primary opacity-100" : "border-transparent opacity-50 hover:opacity-75",
              )}
            >
              <NextImage src={p.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GaleriaManager({
  slug,
  initial,
  canManage,
}: {
  slug: string;
  initial: Photo[];
  canManage: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploading(true);
    for (const raw of Array.from(files)) {
      const compressed = await compressImage(raw);
      const form = new FormData();
      form.set("file", compressed, compressed.name);
      const res = await uploadGalleryPhoto(slug, form);
      if ("error" in res) {
        setErr(res.error);
        break;
      }
      setPhotos((prev) => [...prev, { id: res.id, url: res.url, caption: null }]);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(photoId: string) {
    if (!confirm("Remover esta foto da galeria?")) return;
    setErr(null);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    const res = await deleteGalleryPhoto(slug, photoId);
    if ("error" in res) {
      setErr(res.error);
      // restaura (não conseguimos buscar o item original, mas o reload vai corrigir)
    }
  }

  // drag & drop
  const [dragging, setDragging] = useState(false);
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-6 af-rise">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Galeria</h1>
          <p className="text-muted-foreground text-sm">
            {photos.length === 0 ? "Nenhuma foto ainda." : `${photos.length} foto${photos.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar fotos
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          <Warning className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      {photos.length === 0 ? (
        <Card
          className={cn(
            "border-dashed p-16 text-center transition",
            canManage && "cursor-pointer hover:border-foreground/30",
            dragging && "border-primary bg-primary/5",
          )}
          onDragOver={canManage ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
          onDragLeave={canManage ? () => setDragging(false) : undefined}
          onDrop={canManage ? onDrop : undefined}
          onClick={canManage ? () => inputRef.current?.click() : undefined}
        >
          <Images className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">
            {canManage ? "Arraste fotos aqui ou clique em Adicionar fotos" : "Ainda não há fotos na galeria."}
          </p>
          {canManage && (
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG ou WebP · comprimido automaticamente antes do envio
            </p>
          )}
        </Card>
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3",
            dragging && "ring-2 ring-primary ring-offset-2 rounded-[var(--radius)]",
          )}
          onDragOver={canManage ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
          onDragLeave={canManage ? () => setDragging(false) : undefined}
          onDrop={canManage ? onDrop : undefined}
        >
          {photos.map((p, i) => (
            <div key={p.id} className="group relative aspect-square rounded-[var(--radius)] overflow-hidden bg-muted">
              <NextImage
                src={p.url}
                alt={p.caption ?? `Foto ${i + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition group-hover:scale-105 duration-300"
              />
              {/* overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setLightbox(i)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
                  title="Ampliar"
                >
                  <MagnifyingGlassPlus className="h-4 w-4" />
                </button>
                {canManage && (
                  <button
                    onClick={() => remove(p.id)}
                    className="p-2 rounded-full bg-white/20 hover:bg-red-500/80 text-white transition"
                    title="Remover"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* tile de adicionar (enquanto há fotos) */}
          {canManage && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-[var(--radius)] border-2 border-dashed border-border hover:border-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition"
            >
              {uploading
                ? <CircleNotch className="h-6 w-6 animate-spin" />
                : <><Plus className="h-6 w-6" /><span className="text-xs font-medium">Adicionar</span></>
              }
            </button>
          )}
        </div>
      )}

      {lightbox !== null && (
        <LightboxModal
          photos={photos}
          initialIdx={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
