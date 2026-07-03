"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { requestPushPermission } from "@/lib/firebase";
import { Bell, CircleNotch } from "@phosphor-icons/react/dist/ssr";

type Status = "unsupported" | "default" | "granted" | "denied" | "loading";

/**
 * Opt-in por dispositivo (não é config do salão) — cada navegador/aparelho
 * ativa a própria inscrição. Reflete Notification.permission, que é a fonte
 * de verdade do navegador (não dá pra reverter "denied" por código).
 */
export function PushNotificationsCard({ salonId }: { salonId: string }) {
  const [status, setStatus] = useState<Status>("default");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      // Permissão do navegador concedida não garante que o token chegou a
      // ser salvo no banco (ex.: uma tentativa anterior falhou no meio do
      // caminho) — resincroniza sempre que abrir a tela. requestPermission
      // com permissão já concedida resolve na hora, sem popup.
      activate();
    } else {
      setStatus(Notification.permission as Status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activate() {
    setStatus("loading");
    setErr(null);
    try {
      const result = await requestPushPermission(salonId);
      if (result === "unsupported") {
        setStatus("unsupported");
        setErr("Este navegador não tem suporte a notificações push.");
        return;
      }
      setStatus(result);
      if (result === "denied") {
        setErr("Permissão negada. Ative pelas configurações de notificação do navegador.");
      }
    } catch (e) {
      // Volta pro estado anterior (permission já pode ter sido concedida
      // pelo navegador mesmo se o registro do token falhou) pra poder tentar
      // de novo, e mostra o erro real em vez de ficar preso carregando.
      setStatus(typeof window !== "undefined" && "Notification" in window ? (Notification.permission as Status) : "default");
      setErr((e as { message?: string })?.message ?? "Não foi possível ativar. Tente novamente.");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" /> Notificações push
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Receba um aviso neste dispositivo quando chegar um agendamento novo ou um cancelamento.
      </p>

      <div className="mt-4">
        {status === "unsupported" ? (
          <p className="text-sm text-muted-foreground">Não suportado neste navegador.</p>
        ) : status === "granted" ? (
          <p className="text-sm text-emerald-600 font-medium">Ativado neste dispositivo.</p>
        ) : (
          <button
            type="button"
            onClick={activate}
            disabled={status === "loading" || status === "denied"}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60 hover:opacity-90 transition"
          >
            {status === "loading" && <CircleNotch className="h-4 w-4 animate-spin" />}
            Ativar notificações neste dispositivo
          </button>
        )}
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      </div>
    </Card>
  );
}
