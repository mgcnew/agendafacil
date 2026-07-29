"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { MotionModal } from "@/components/MotionModal";
import { Calendar } from "@/components/Calendar";
import { formatBRL, cn } from "@/lib/utils";
import { CalendarDots, CaretDown, CircleNotch, X } from "@phosphor-icons/react/dist/ssr";
import { DAY_SHORT, MONTH_NAMES, parse, type Client, type Pro, type Service } from "./shared";

/**
 * Formulário de novo agendamento.
 *
 * Saiu do AgendaManager para poder abrir de qualquer tela do painel (botão
 * central da barra inferior). Ele não depende da grade: recebe as listas
 * prontas e resolve sozinho os horários livres via `get_availability`.
 */
export function CreateAppointment({
  salonId, pros, services, clients, discounts, date: initialDate, initialPro, initialTime, initialClient, onClose, onCreated,
}: {
  salonId: string; pros: Pro[]; services: Service[]; clients: Client[];
  discounts: Record<string, number>;
  date: string; initialPro?: string; initialTime?: string; initialClient?: string;
  onClose: () => void; onCreated: () => void;
}) {
  const supabase = createClient();
  const [clientName, setClientName]     = useState("");
  const [clientPhone, setClientPhone]   = useState("");
  // Pré-seleciona o cliente se ele já existir na lista (ex.: veio da ficha).
  const [existingClient, setExisting]   = useState(
    initialClient && clients.some(c => c.id === initialClient) ? initialClient : "",
  );
  const [proId, setProId]               = useState(initialPro ?? pros[0]?.id ?? "");
  // Aplica o horário clicado na grade só uma vez, assim que os slots carregam.
  const initialTimeUsed = useRef(false);
  const [selected, setSelected]         = useState<string[]>([]);
  const [date, setDate]                 = useState(initialDate);
  const [showCal, setShowCal]           = useState(false);
  const [slot, setSlot]                 = useState<string>("");
  const [slots, setSlots]               = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [err, setErr]                   = useState<string | null>(null);
  const [svcSearch, setSvcSearch]       = useState("");
  const [lastSvcs, setLastSvcs]         = useState<{ id: string; name: string }[] | null>(null);

  const dateLabel = (() => {
    const d = parse(date);
    return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
  })();

  const discOf     = (s: Service) => discounts[s.id] ?? 0;
  const effOf      = (s: Service) => {
    const d = discOf(s);
    return d > 0 ? Math.round(Number(s.price) * (1 - d / 100) * 100) / 100 : Number(s.price);
  };
  const chosen     = services.filter(s => selected.includes(s.id));
  const totalPrice = chosen.reduce((a, s) => a + effOf(s), 0);
  const totalDuration = chosen.reduce((a, s) => a + s.duration_min, 0);

  // Último serviço do cliente selecionado
  useEffect(() => {
    if (!existingClient) { setLastSvcs(null); return; }
    supabase
      .from("appointments")
      .select("id, appointment_services(service_id, services(id, name))")
      .eq("client_id", existingClient)
      .eq("salon_id", salonId)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setLastSvcs(null); return; }
        type AptSvc = { service_id: string; services: { id: string; name: string } | null };
        const svcs = (data.appointment_services as AptSvc[])
          .filter(r => r.services)
          .map(r => ({ id: r.services!.id, name: r.services!.name }));
        setLastSvcs(svcs.length ? svcs : null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingClient, salonId]);

  useEffect(() => {
    if (!proId || totalDuration <= 0) { setSlots([]); setSlot(""); return; }
    let cancelled = false;
    setLoadingSlots(true);
    supabase
      .rpc("get_availability", { p_salon: salonId, p_member: proId, p_date: date, p_duration: totalDuration })
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data as string[]) ?? [];
        setSlots(list);
        setSlot(cur => {
          if (list.includes(cur)) return cur;
          // primeira carga: tenta casar com o horário clicado na grade
          if (!initialTimeUsed.current && initialTime) {
            initialTimeUsed.current = true;
            const match = list.find(s => slotLabel(s) === initialTime);
            if (match) return match;
          }
          return "";
        });
        setLoadingSlots(false);
      });
    return () => { cancelled = true; };
  }, [supabase, salonId, proId, date, totalDuration]);

  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  async function create() {
    if (!slot) { setErr("Escolha um horário disponível."); return; }
    setBusy(true); setErr(null);
    try {
      let clientId = existingClient || null;
      if (!clientId) {
        if (!clientName.trim()) { setErr("Informe o nome da cliente."); setBusy(false); return; }
        const { data: c, error: ce } = await supabase
          .from("clients")
          .insert({ salon_id: salonId, full_name: clientName.trim(), phone: clientPhone || null })
          .select("id").single();
        if (ce) throw ce;
        clientId = c.id;
      }
      const { error } = await supabase.rpc("create_staff_appointment", {
        p_salon: salonId, p_member: proId, p_client: clientId,
        p_service_ids: selected,
        p_starts_at: slot,
      });
      if (error) {
        const m = error.message;
        setErr(
          m.includes("slot_taken")
            ? "A profissional já está ocupada nesse horário."
            : m.includes("client_busy")
              ? "Esta cliente já tem um atendimento nesse horário. Ative simultâneos nas Configurações para permitir."
              : "Não foi possível criar o agendamento.",
        );
        setBusy(false); return;
      }
      onCreated();
    } catch {
      setErr("Não foi possível criar o agendamento.");
      setBusy(false);
    }
  }

  const filteredServices = svcSearch.trim()
    ? services.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase()))
    : services;

  const serviceButtons = filteredServices.map(s => {
    const on = selected.includes(s.id);
    return (
      <button
        key={s.id} type="button"
        onClick={() => setSelected(p => on ? p.filter(x => x !== s.id) : [...p, s.id])}
        className={cn(
          "w-full flex items-center justify-between rounded-[var(--radius)] border p-2.5 text-sm transition",
          on ? "border-primary bg-secondary/40" : "border-border hover:border-foreground/20",
        )}
      >
        <span className="flex items-center gap-1.5">
          {s.name}
          {discOf(s) > 0 && (
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">-{discOf(s)}%</span>
          )}
        </span>
        {discOf(s) > 0 ? (
          <span>
            <span className="text-muted-foreground line-through mr-1.5">{formatBRL(Number(s.price))}</span>
            <span className="text-foreground">{formatBRL(effOf(s))}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{formatBRL(Number(s.price))}</span>
        )}
      </button>
    );
  });

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-auto sm:overflow-hidden p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold">Novo agendamento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {/* Desktop: two columns. Mobile: single column */}
        <div className="sm:flex sm:gap-6 sm:min-h-[440px]">

          {/* Left column — fields */}
          <div className="space-y-4 sm:w-60 sm:shrink-0 sm:flex sm:flex-col sm:space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={existingClient} onValueChange={v => { setExisting(v); setSelected([]); }}>
                <option value="">+ Nova cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </Select>
            </div>
            {!existingClient && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} />
                <Input placeholder="Celular" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
              </div>
            )}
            {lastSvcs && (
              <div className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground truncate">
                  Último: <span className="text-foreground font-medium">{lastSvcs.map(s => s.name).join(", ")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(lastSvcs.map(s => s.id).filter(id => services.some(sv => sv.id === id)))}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  Usar
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={proId} onValueChange={setProId}>
                {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>

            {/* Serviços — mobile only */}
            <div className="space-y-1.5 sm:hidden">
              <Label>Serviços</Label>
              <Input
                placeholder="Buscar serviço…"
                value={svcSearch}
                onChange={e => setSvcSearch(e.target.value)}
              />
              <div className="space-y-1.5 max-h-44 overflow-auto">{serviceButtons}</div>
            </div>

            {/* Data — mobile: toggle; desktop: calendário fixo */}
            <div className="space-y-1.5">
              <Label>Data</Label>
              <button
                type="button"
                onClick={() => setShowCal(v => !v)}
                aria-expanded={showCal}
                className="sm:hidden h-11 w-full flex items-center justify-between rounded-[var(--radius)] border border-border bg-card px-3.5 text-sm text-foreground hover:border-foreground/25 transition"
              >
                <span className="flex items-center gap-2">
                  <CalendarDots className="h-4 w-4 text-muted-foreground shrink-0" />
                  {dateLabel}
                </span>
                <CaretDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showCal && "rotate-180")} />
              </button>
              {showCal && (
                <Calendar value={date} onChange={(d) => { setDate(d); setShowCal(false); }} className="mt-1 sm:hidden" />
              )}
              <Calendar value={date} onChange={(d) => setDate(d)} className="hidden sm:block" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Select
                  value={slot}
                  onValueChange={setSlot}
                  disabled={loadingSlots || slots.length === 0}
                  placeholder={
                    totalDuration <= 0 ? "Escolha serviços"
                      : loadingSlots ? "Carregando…"
                        : slots.length === 0 ? "Sem horários" : "Selecione"
                  }
                >
                  {slots.map(s => <option key={s} value={s}>{slotLabel(s)}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <div className="h-11 flex items-center font-semibold text-primary">{formatBRL(totalPrice)}</div>
              </div>
            </div>

            {proId && totalDuration > 0 && !loadingSlots && slots.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum horário livre nesta data para esta profissional. Verifique os horários de trabalho em Configurações.
              </p>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button className="w-full sm:mt-auto" onClick={create} disabled={busy || selected.length === 0 || !slot}>
              {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Criar agendamento
            </Button>
          </div>

          {/* Right column — services (desktop only) */}
          <div className="hidden sm:flex sm:flex-col sm:flex-1 sm:min-w-0">
            <Label className="mb-2">Serviços</Label>
            <Input
              placeholder="Buscar serviço…"
              value={svcSearch}
              onChange={e => setSvcSearch(e.target.value)}
              className="mb-2"
            />
            <div className="flex-1 overflow-auto space-y-1.5 pr-0.5">{serviceButtons}</div>
          </div>

        </div>
      </Card>
    </MotionModal>
  );
}
