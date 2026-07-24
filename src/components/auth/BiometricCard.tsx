"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { biometricAvailable, enrollBiometric } from "@/lib/webauthn/client";
import { Fingerprint, Check, CircleNotch, X } from "@phosphor-icons/react/dist/ssr";

const ENROLLED_KEY = "af:bio-enrolled";
const DISMISS_KEY = "af:bio-prompt-dismissed";

function guessDeviceName(): string {
  if (typeof navigator === "undefined") return "Aparelho";
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  return "Aparelho";
}

/**
 * Ativa a entrada por digital/Face ID NESTE aparelho (opt-in por dispositivo,
 * como as notificações). Usado nas Configurações e como card pós-login.
 * - `dismissible`: mostra o "X" e some quando dispensado (card da home).
 */
export function BiometricCard({ dismissible = false }: { dismissible?: boolean }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    biometricAvailable().then(setAvailable);
    try {
      setEnrolled(localStorage.getItem(ENROLLED_KEY) === "1");
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {}
  }, []);

  async function activate() {
    setLoading(true);
    setError(null);
    const res = await enrollBiometric(guessDeviceName());
    setLoading(false);
    if (res.ok || res.error === "already_registered") {
      setEnrolled(true);
      try {
        localStorage.setItem(ENROLLED_KEY, "1");
      } catch {}
      return;
    }
    if (res.error !== "cancelled") {
      setError("Não foi possível ativar a digital neste aparelho. Tente de novo.");
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  // Não renderiza enquanto checa; some se não há suporte no aparelho.
  if (available === null || available === false) return null;
  // No modo prompt (home), some depois de ativado ou dispensado.
  if (dismissible && (enrolled || dismissed)) return null;

  return (
    <Card className="relative p-4 sm:p-5">
      {dismissible && (
        <button
          type="button"
          aria-label="Dispensar"
          onClick={dismiss}
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius)] bg-primary/10 text-primary">
          <Fingerprint className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Entrar com digital</p>
          {enrolled ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Ativada neste aparelho
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ative para entrar com a digital ou Face ID neste aparelho, sem digitar a senha.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={activate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <Fingerprint className="h-4 w-4" />
                  )}
                  Ativar neste aparelho
                </button>
                {dismissible && (
                  <button
                    type="button"
                    onClick={dismiss}
                    className="rounded-[var(--radius)] px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Agora não
                  </button>
                )}
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
