"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m } from "framer-motion";

/** O que o Tab alcança dentro do modal. */
const FOCALIZAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MotionModal({
  onClose,
  label,
  children,
}: {
  onClose?: () => void;
  /** Só quando não há título dentro do modal — se houver, ele vira o rótulo. */
  label?: string;
  children: React.ReactNode;
}) {
  const [attrs, setAttrs] = useState<{ niche?: string; color?: string }>({});
  const [mounted, setMounted] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    setMounted(true);
    const el = document.querySelector("[data-niche]");
    setAttrs({
      niche: el?.getAttribute("data-niche") ?? undefined,
      color: el?.getAttribute("data-color") ?? undefined,
    });
  }, []);

  // Nome do diálogo e ida/volta do foco.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;

    // Um diálogo sem nome é anunciado como "diálogo" e nada mais. Em vez de
    // repetir o texto num `label` nas 16 telas que usam isto, adotamos o
    // título que já está dentro do modal.
    if (!label) {
      const titulo = el.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6");
      if (titulo) {
        if (!titulo.id) titulo.id = idTitulo;
        el.setAttribute("aria-labelledby", titulo.id);
      }
    }

    // Sem devolver o foco, quem navega por teclado volta pro topo da página a
    // cada modal fechado e refaz todo o caminho.
    const anterior = document.activeElement as HTMLElement | null;
    // Focar a caixa, e não o primeiro botão, faz o leitor de tela anunciar o
    // título em vez de "Fechar". Se algum campo filho já pediu `autoFocus`,
    // respeitamos a escolha dele.
    if (!el.contains(document.activeElement)) el.focus();
    return () => anterior?.focus?.();
  }, [mounted, label, idTitulo]);

  // Escape fecha; Tab não escapa.
  useEffect(() => {
    if (!mounted) return;

    function aoTeclar(e: KeyboardEvent) {
      const el = caixa.current;
      if (!el) return;

      // Modal sobre modal: só o de cima responde.
      const abertos = document.querySelectorAll("[data-modal-caixa]");
      if (abertos[abertos.length - 1] !== el) return;

      if (e.key === "Escape") {
        // Um select ou uma busca aberta dentro do modal fecha primeiro. Sem
        // isso, um Escape fechava o popover e o modal junto, e a pessoa perdia
        // o formulário inteiro por ter desistido de escolher um item.
        if (el.querySelector('[aria-expanded="true"]')) return;
        if (onClose) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key !== "Tab") return;
      const alvos = Array.from(el.querySelectorAll<HTMLElement>(FOCALIZAVEL)).filter(
        (n) => n.getClientRects().length > 0,
      );
      if (alvos.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const atual = document.activeElement;
      if (!el.contains(atual)) {
        e.preventDefault();
        primeiro.focus();
      } else if (e.shiftKey && (atual === primeiro || atual === el)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      data-niche={attrs.niche}
      data-color={attrs.color}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center text-foreground bg-transparent"
    >
      <m.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        aria-hidden
      />
      <m.div
        ref={caixa}
        data-modal-caixa=""
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative w-full outline-none"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </div>,
    document.body,
  );
}
