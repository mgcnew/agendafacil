"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MotionModal } from "@/components/MotionModal";
import { Card } from "@/components/ui";
import { CircleNotch, Check, Warning } from "@phosphor-icons/react/dist/ssr";
import { CreateAppointment } from "@/app/painel/[slug]/agenda/CreateAppointment";
import { toStr, type Client, type Pro, type Service } from "@/app/painel/[slug]/agenda/shared";

type Listas = {
  pros: Pro[];
  services: Service[];
  clients: Client[];
  discounts: Record<string, number>;
};

/**
 * Novo agendamento por cima da tela atual.
 *
 * Antes o botão central da barra levava pra Agenda: quem estava no meio de uma
 * venda no Caixa perdia o que tinha montado só pra encaixar um horário. A
 * Agenda continua tendo o formulário dela (lá ele já sabe o dia que está na
 * tela); isto aqui é pro resto do painel.
 *
 * As listas não vêm do servidor no layout de propósito — seriam quatro
 * consultas em TODA página do painel pra atender um botão que a maioria das
 * visitas não toca. Busca ao abrir, uma vez por sessão.
 */
export function QuickAppointment({
  salonId,
  open,
  onClose,
}: {
  salonId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [listas, setListas] = useState<Listas | null>(null);
  const [erro, setErro] = useState(false);
  const [criado, setCriado] = useState(false);

  useEffect(() => {
    if (!open || listas) return;
    let vivo = true;
    const supabase = createClient();

    (async () => {
      setErro(false);
      const [{ data: pros }, { data: services }, { data: clients }, { data: discountRows }, { data: proSvcRows }] =
        await Promise.all([
          supabase
            .from("salon_members")
            .select("id, display_name, profiles(full_name), commission_percent, color, photo_url")
            .eq("salon_id", salonId)
            .eq("is_active", true),
          supabase
            .from("services")
            .select("id, name, duration_min, price, commission_percent, color")
            .eq("salon_id", salonId)
            .eq("is_active", true),
          supabase
            .from("clients")
            .select("id, full_name, phone")
            .eq("salon_id", salonId)
            .order("full_name"),
          supabase.rpc("public_campaign_discounts", { p_salon: salonId }),
          supabase
            .from("professional_services")
            .select("member_id")
            .eq("salon_id", salonId),
        ]);

      if (!vivo) return;

      if (!pros || !services) {
        setErro(true);
        return;
      }

      const discounts: Record<string, number> = {};
      for (const r of (discountRows as { service_id: string; discount_percent: number }[] | null) ?? []) {
        discounts[r.service_id] = Number(r.discount_percent);
      }

      // Mesma regra da Agenda: profissional sem nenhum serviço vinculado não
      // aparece — não haveria horário livre nenhum pra oferecer.
      const comServico = new Set((proSvcRows ?? []).map((r) => r.member_id));

      setListas({
        pros: pros
          .filter((p) => comServico.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.display_name ?? (p.profiles as { full_name?: string } | null)?.full_name ?? "—",
            commission_percent: p.commission_percent,
            color: p.color,
            photo_url: p.photo_url,
          })),
        services,
        clients: clients ?? [],
        discounts,
      });
    })();

    return () => { vivo = false; };
  }, [open, listas, salonId]);

  // O aviso de sucesso sobrevive ao fechamento do modal: sem ele o dono volta
  // pro Caixa sem nenhuma pista de que o agendamento entrou.
  useEffect(() => {
    if (!criado) return;
    const t = setTimeout(() => setCriado(false), 3500);
    return () => clearTimeout(t);
  }, [criado]);

  return (
    <>
      {open && (!listas || erro) && (
        <MotionModal onClose={onClose}>
          <Card className="mx-auto w-full max-w-sm rounded-b-none p-8 text-center sm:rounded-[var(--radius)]">
            {erro ? (
              <>
                <Warning className="mx-auto h-6 w-6 text-amber-600" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Não deu para carregar serviços e profissionais. Tente de novo.
                </p>
              </>
            ) : (
              <>
                <CircleNotch className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Abrindo novo agendamento…</p>
              </>
            )}
          </Card>
        </MotionModal>
      )}

      {open && listas && !erro && (
        <CreateAppointment
          salonId={salonId}
          pros={listas.pros}
          services={listas.services}
          clients={listas.clients}
          discounts={listas.discounts}
          date={toStr(new Date())}
          onClose={onClose}
          onCreated={() => {
            onClose();
            setCriado(true);
            // A tela embaixo pode depender do agendamento novo (Caixa, ficha do
            // cliente, início). A Agenda não precisa: ela ouve realtime.
            router.refresh();
          }}
        />
      )}

      {criado && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:hidden">
          <p className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            <Check className="h-4 w-4" weight="bold" /> Agendamento criado
          </p>
        </div>
      )}
    </>
  );
}
