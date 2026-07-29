"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NextImage from "next/image";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  CaretLeft,
  CaretRight,
  CircleNotch,
  Images,
  MagnifyingGlassMinus,
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

const ZOOM = 2.5;

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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const arrastando = useRef<{ x: number; y: number } | null>(null);
  // Espelho do ref em estado: a transição da foto depende dele para renderizar,
  // e ref não pode ser lido durante a renderização.
  const [movendo, setMovendo] = useState(false);
  const tiraRef = useRef<HTMLDivElement>(null);
  const ativaRef = useRef<HTMLButtonElement>(null);

  // Trocar de foto sempre volta ao tamanho normal: a próxima entrando já
  // ampliada ficaria deslocada no ponto errado.
  const irPara = useCallback((i: number) => {
    setIdx(i);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const prev = useCallback(
    () => irPara((idx - 1 + photos.length) % photos.length),
    [irPara, idx, photos.length],
  );
  const next = useCallback(
    () => irPara((idx + 1) % photos.length),
    [irPara, idx, photos.length],
  );

  // Antes isto vivia dentro de um useState(() => …): o listener era registrado
  // durante a renderização e o cleanup virava VALOR de estado, nunca chamado.
  // Cada abertura do lightbox deixava mais um listener preso na window.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  // Sem isto a página continua rolando atrás da foto ampliada.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, []);

  // Com muitas fotos a tira passa da largura da tela: sem isto, navegar pelas
  // setas movia a foto grande e a miniatura ativa ficava fora de vista.
  useEffect(() => {
    ativaRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [idx]);

  const swipeX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    // Com zoom, o arrasto é para deslocar a foto, não para trocar de foto.
    swipeX.current = zoom > 1 ? null : e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (swipeX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next(); else prev();
    }
    swipeX.current = null;
  };

  function alternarZoom() {
    setZoom((z) => (z > 1 ? 1 : ZOOM));
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (zoom === 1) return;
    arrastando.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    setMovendo(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!arrastando.current) return;
    setPan({ x: e.clientX - arrastando.current.x, y: e.clientY - arrastando.current.y });
  }
  function onPointerUp() {
    arrastando.current = null;
    setMovendo(false);
  }

  const photo = photos[idx];
  // O lightbox só existe depois de um clique, então nunca renderiza no
  // servidor — a guarda é só para o portal não procurar body onde não há DOM.
  if (typeof document === "undefined") return null;

  return createPortal(
    // Portal para o body de propósito. A página da Galeria tem `af-rise`, que
    // termina em `transform: translateY(0)` por causa do fill-mode `both` — e
    // QUALQUER transform diferente de none faz o elemento virar bloco de
    // contenção para descendentes `fixed`. O lightbox estava sendo medido
    // contra a div da galeria, não contra a janela: com poucas fotos essa div
    // é baixa, e a foto "ampliada" saía menor que a miniatura.
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <span className="text-sm tabular-nums text-white/60">
          {idx + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={alternarZoom}
            aria-pressed={zoom > 1}
            title={zoom > 1 ? "Reduzir" : "Ampliar"}
            className={cn(
              "rounded-full p-2 transition",
              zoom > 1 ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {zoom > 1
              ? <MagnifyingGlassMinus className="h-5 w-5" />
              : <MagnifyingGlassPlus className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            title="Fechar"
            className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-14">
        {photos.length > 1 && zoom === 1 && (
          <button
            onClick={prev}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <CaretLeft className="h-6 w-6" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.caption ?? `Foto ${idx + 1}`}
          onClick={alternarZoom}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            // Só anima o zoom; animar o arrasto deixaria a foto "escorregando"
            // atrás do dedo.
            transition: movendo ? "none" : "transform 0.2s ease-out",
          }}
          className={cn(
            "max-h-full max-w-full select-none rounded-lg object-contain",
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          )}
        />

        {photos.length > 1 && zoom === 1 && (
          <button
            onClick={next}
            aria-label="Próxima foto"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <CaretRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* A legenda existia no banco e na tela pública, e aqui era ignorada — o
          dono não tinha onde conferir o que o cliente lê. */}
      {photo.caption && (
        <p className="shrink-0 px-6 pt-2 text-center text-sm text-white/70">{photo.caption}</p>
      )}

      {photos.length > 1 && (
        <div ref={tiraRef} className="shrink-0 overflow-x-auto scrollbar-none px-4 py-3">
          {/* w-max + mx-auto centraliza quando cabe e continua rolável quando
              não cabe. Com justify-center num container que rola, o começo da
              tira fica inalcançável. */}
          <div className="mx-auto flex w-max gap-2">
            {photos.map((p, i) => (
              <button
                key={p.id}
                ref={i === idx ? ativaRef : undefined}
                onClick={() => irPara(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={cn(
                  "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition",
                  i === idx
                    ? "border-primary opacity-100"
                    : "border-transparent opacity-50 hover:opacity-75",
                )}
              >
                <NextImage src={p.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-white/40">
        {zoom > 1 ? "Arraste para mover · toque para reduzir" : "Toque na foto para ampliar"}
      </p>
    </div>,
    document.body,
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
            // A foto inteira abre o lightbox. Antes só a lupa abria, e ela
            // vivia dentro de um overlay `group-hover` — no celular, onde não
            // existe hover, tocar na foto simplesmente não fazia nada.
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[var(--radius)] bg-muted">
              <button
                onClick={() => setLightbox(i)}
                aria-label={`Ampliar foto ${i + 1}`}
                className="absolute inset-0"
              >
                <NextImage
                  src={p.url}
                  alt={p.caption ?? `Foto ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 hidden items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100 sm:flex">
                  <span className="rounded-full bg-white/20 p-2 text-white">
                    <MagnifyingGlassPlus className="h-4 w-4" />
                  </span>
                </span>
              </button>

              {/* No celular fica sempre visível: com hover-only, apagar uma
                  foto era impossível pelo telefone. */}
              {canManage && (
                <button
                  onClick={() => remove(p.id)}
                  title="Remover"
                  aria-label={`Remover foto ${i + 1}`}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition hover:bg-red-500/85 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" />
                </button>
              )}
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
