"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui";
import { LoginForm } from "@/components/auth/LoginForm";
import { Scissors, X } from "lucide-react";

/**
 * Botão "Entrar" da landing que abre um modal de login, evitando uma
 * navegação extra. A rota /entrar segue existindo como fallback para
 * redirects de middleware, logout e deep-links.
 */
export function LoginButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Entrar
      </Button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Card */}
          <div className="relative w-full max-w-sm rounded-[var(--radius)] border border-border bg-card p-6 sm:p-7 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute right-4 top-4 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
                <Scissors className="h-5 w-5" />
              </span>
              AgendeFácil
            </div>

            <h2 id="login-modal-title" className="font-display text-xl mt-4">
              Bem-vinda de volta
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Acesse o painel do seu salão.
            </p>

            <div className="mt-6">
              <LoginForm onSuccess={() => setOpen(false)} />
            </div>

            <p className="mt-6 text-sm text-muted-foreground text-center">
              Ainda não tem salão?{" "}
              <Link
                href="/criar-salao"
                className="text-primary font-medium"
                onClick={() => setOpen(false)}
              >
                Criar agora
              </Link>
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
