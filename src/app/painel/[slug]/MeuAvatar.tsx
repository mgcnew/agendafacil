"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image";
import { uploadMemberPhoto } from "./equipe/actions";

/**
 * Foto de quem está logado, ao lado do modo noturno. O painel é de um salão,
 * mas quem está usando é uma pessoa: o rosto dela ali faz o sistema parecer
 * dela. Clicar troca a foto — sem foto, é o convite para colocar uma.
 *
 * A mesma foto aparece para as clientes na página de agendamento.
 */
export function MeuAvatar({
  salonId,
  memberId,
  nome,
  fotoUrl,
  size = "md",
  className,
}: {
  salonId: string;
  memberId: string;
  nome: string;
  fotoUrl: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(fotoUrl);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setEnviando(true);
    setErro(null);
    try {
      const blob = await compressImage(file);
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await uploadMemberPhoto(salonId, memberId, form);
      if ("error" in res) {
        setErro("Não foi possível trocar a foto.");
        return;
      }
      setFoto(res.url);
      // Equipe, agenda e página de agendamento leem a mesma foto.
      router.refresh();
    } catch {
      setErro("Não consegui usar essa imagem. Tente uma foto JPG ou PNG.");
    } finally {
      setEnviando(false);
    }
  }

  const inicial = (nome.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  const rotulo = foto ? `${nome} — trocar sua foto` : `${nome} — colocar sua foto`;
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={enviando}
        aria-label={rotulo}
        title={erro ?? rotulo}
        className={cn(
          "group relative grid shrink-0 place-items-center rounded-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
          className,
        )}
      >
        <span
          className={cn(
            "relative grid place-items-center overflow-hidden rounded-full font-semibold",
            "ring-2 ring-[var(--card)] outline outline-1 outline-border transition",
            "group-hover:outline-primary/60",
            !foto && "bg-secondary text-secondary-foreground",
            erro && "outline-red-500",
            dim,
          )}
        >
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{inicial}</span>
          )}
          {enviando && (
            <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
              <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
            </span>
          )}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={escolher}
      />
    </>
  );
}
