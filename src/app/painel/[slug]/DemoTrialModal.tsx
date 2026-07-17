"use client";

import { useEffect, useState } from "react";
import { MotionModal } from "@/components/MotionModal";
import { Button, Input, Label } from "@/components/ui";
import { CircleNotch, Confetti, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { CONSENT_TEXT, TRIAL_DAYS } from "@/lib/demoLead";
import { captureDemoLeadAction } from "./demoLeadActions";

/** Tempo de casa antes de oferecer o teste. Cedo demais parece isca. */
const UNLOCK_MS = 45_000;
const KEY_START = "zulan:demo:startedAt";
const KEY_DONE = "zulan:demo:leadDone";

/**
 * Oferece os 14 dias depois que a pessoa já mexeu no demo por um tempo.
 *
 * A captura é aqui, e não na porta de entrada, de propósito: quem preenche
 * já viu o sistema funcionando e quer o teste — o contato vem de gente
 * interessada, em vez de e-mail inventado só pra passar do formulário. E o
 * demo em 1 clique continua sem atrito, que é o que serve no porta a porta.
 *
 * O relógio começa na 1ª visita e mora no localStorage: navegar entre as
 * telas do painel recarrega a página e zeraria um contador em memória.
 */
export function DemoTrialModal({ vertical }: { vertical: "salao" | "barbearia" }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accepts, setAccepts] = useState(false); // desmarcado: aceite tem que ser livre
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(KEY_DONE)) return;

    const started = Number(localStorage.getItem(KEY_START)) || Date.now();
    localStorage.setItem(KEY_START, String(started));

    const tick = () => {
      if (Date.now() - started >= UNLOCK_MS) {
        setOpen(true);
        clearInterval(id);
      }
    };
    const id = setInterval(tick, 1_000);
    tick();
    return () => clearInterval(id);
  }, []);

  function close() {
    // Respeita o "agora não": não volta a aparecer neste navegador.
    localStorage.setItem(KEY_DONE, "1");
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await captureDemoLeadAction(name, email, phone, accepts);
    if (!res.ok) {
      setError(res.message ?? "Não consegui salvar agora.");
      setLoading(false);
      return;
    }

    localStorage.setItem(KEY_DONE, "1");
    setDone(true);
    setLoading(false);
  }

  if (!open) return null;

  const signupUrl =
    `/criar-salao?tipo=${vertical}` +
    `&nome=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;

  return (
    <MotionModal onClose={close}>
      <div className="mx-auto w-full max-w-md rounded-t-[var(--radius)] sm:rounded-[var(--radius)] border border-border bg-card p-6 shadow-xl">
        <div className="text-center">
          <span className="grid place-items-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto">
            <Confetti className="h-7 w-7" weight="fill" />
          </span>

          {done ? (
            <>
              <h2 className="font-display text-xl font-bold mt-4">
                Pronto, {name.trim().split(/\s+/)[0]}!
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Seus {TRIAL_DAYS} dias estão reservados. Falta só criar o seu salão —
                aí você usa tudo isso com os seus serviços, sua equipe e suas clientes.
              </p>
              <a href={signupUrl} className="inline-block w-full mt-6">
                <Button className="w-full">
                  Criar meu salão e ativar os {TRIAL_DAYS} dias
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground mt-3 hover:text-foreground transition"
              >
                Continuar olhando a demonstração
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold mt-4">
                Você desbloqueou {TRIAL_DAYS} dias de teste
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Gostou do que viu? Deixa seu contato que eu libero o sistema completo
                por {TRIAL_DAYS} dias no <b className="text-foreground">seu</b> salão.
                Sem cartão.
              </p>

              <form onSubmit={onSubmit} className="mt-5 space-y-3 text-left">
                <div>
                  <Label htmlFor="lead-nome">Seu nome</Label>
                  <Input
                    id="lead-nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lead-zap">WhatsApp</Label>
                  <Input
                    id="lead-zap"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lead-email">E-mail</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={accepts}
                    onChange={(e) => setAccepts(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="text-xs text-muted-foreground leading-snug">
                    {CONSENT_TEXT}
                  </span>
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Quero meus {TRIAL_DAYS} dias</>
                  )}
                </Button>
              </form>

              <button
                type="button"
                onClick={close}
                className="text-xs text-muted-foreground mt-3 hover:text-foreground transition"
              >
                Agora não, só estou olhando
              </button>
            </>
          )}
        </div>
      </div>
    </MotionModal>
  );
}
