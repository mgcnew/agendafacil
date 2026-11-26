"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { MotionModal } from "@/components/MotionModal";
import { ClientCombobox } from "@/components/ClientCombobox";
import { cn } from "@/lib/utils";
import { maskBrPhone, toStoredPhone } from "@/lib/whatsapp/phone";
import { CircleNotch, Clock, X } from "@phosphor-icons/react/dist/ssr";
import { toStr, type Client, type Pro, type Service } from "./shared";

/** O que já se sabe quando a espera nasce de outra tela (ex.: dia lotado no
 *  novo agendamento), pra ninguém digitar de novo. */
export type WaitlistPrefill = {
  date: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  proId?: string;
  serviceIds?: string[];
};

/**
 * Põe uma cliente na lista de espera pelo painel.
 *
 * Antes só o link público fazia isso, e no feriado quem liga pedindo "qualquer
 * horário na sexta" não vai abrir link nenhum. A linha é a mesma que o link
 * grava, então o quadro da Agenda e o aviso de vaga aberta no WhatsApp tratam
 * as duas igual.
 */
export function WaitlistModal({
  salonId, pros, services, clients, prefill, onClose, onCreated,
}: {
  salonId: string; pros: Pro[]; services: Service[]; clients: Client[];
  prefill: WaitlistPrefill;
  onClose: () => void; onCreated: () => void;
}) {
  const supabase = createClient();
  const today = toStr(new Date());
  const [existingClient, setExisting] = useState(
    prefill.clientId && clients.some(c => c.id === prefill.clientId) ? prefill.clientId : "",
  );
  const [clientName, setClientName]   = useState(prefill.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(prefill.clientPhone ?? "");
  const [date, setDate]               = useState(prefill.date < today ? today : prefill.date);
  const [proId, setProId]             = useState(prefill.proId ?? ""); // "" = qualquer profissional
  const [selected, setSelected]       = useState<string[]>(prefill.serviceIds ?? []);
  const [notes, setNotes]             = useState("");
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  function toggle(id: string) {
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  }

  async function save() {
    if (!date || date < today) { setErr("Escolha um dia de hoje em diante."); return; }
    setBusy(true); setErr(null);
    try {
      let clientId = existingClient || null;
      if (!clientId) {
        if (!clientName.trim()) { setErr("Informe o nome da cliente."); setBusy(false); return; }
        const phone = clientPhone.trim() ? toStoredPhone(clientPhone) : null;
        if (clientPhone.trim() && !phone) {
          setErr("Confira o telefone: celular com DDD, como (11) 98765-4321.");
          setBusy(false); return;
        }
        // Quem liga às vezes já tem ficha e a recepção não achou na busca:
        // pelo telefone, reaproveita em vez de duplicar a cliente.
        const known = phone ? clients.find(c => c.phone === phone) : undefined;
        if (known) {
          clientId = known.id;
        } else {
          const { data: c, error: ce } = await supabase
            .from("clients")
            .insert({ salon_id: salonId, full_name: clientName.trim(), phone })
            .select("id").single();
          if (ce) throw ce;
          clientId = c.id;
        }
      }

      const { data: dup } = await supabase
        .from("appointment_waitlist")
        .select("id")
        .eq("salon_id", salonId)
        .eq("client_id", clientId)
        .eq("preferred_date", date)
        .eq("status", "waiting")
        .limit(1);
      if (dup && dup.length > 0) {
        setErr("Essa cliente já está na lista de espera desse dia.");
        setBusy(false); return;
      }

      const { error } = await supabase.from("appointment_waitlist").insert({
        salon_id: salonId,
        client_id: clientId,
        member_id: proId || null,
        service_ids: selected,
        preferred_date: date,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      onCreated();
    } catch {
      setErr("Não foi possível pôr na lista de espera. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-md mx-auto max-h-[92dvh] flex flex-col overflow-hidden p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Clock aria-hidden className="h-5 w-5 text-primary" /> Pôr na lista de espera
            </h3>
            <p className="text-sm text-muted-foreground">Se abrir vaga nesse dia, ela aparece no topo da Agenda.</p>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <ClientCombobox clients={clients} value={existingClient} onChange={setExisting} />
            {!existingClient && (
              <div className="grid grid-cols-2 gap-3">
                <label htmlFor="espera-cli-nome" className="sr-only">Nome da cliente</label>
                <Input id="espera-cli-nome" placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} />
                <label htmlFor="espera-cli-fone" className="sr-only">Celular da cliente</label>
                <Input id="espera-cli-fone" placeholder="Celular" inputMode="numeric" value={clientPhone} onChange={e => setClientPhone(maskBrPhone(e.target.value))} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="espera-dia">Dia</Label>
              <Input id="espera-dia" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espera-pro">Profissional</Label>
              <Select id="espera-pro" value={proId} onValueChange={setProId}>
                <option value="">Qualquer profissional</option>
                {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Serviços <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <div role="group" aria-label="Serviços" className="flex flex-wrap gap-2">
              {services.map(s => {
                const on = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      on ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="espera-obs">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="espera-obs" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: só depois das 15h" />
          </div>

          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Pôr na lista
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </MotionModal>
  );
}
