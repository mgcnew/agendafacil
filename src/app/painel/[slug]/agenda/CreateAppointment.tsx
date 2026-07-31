"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { MotionModal } from "@/components/MotionModal";
import { ClientCombobox } from "@/components/ClientCombobox";
import { DateStrip } from "@/components/DateStrip";
import { TimeSlots } from "@/components/TimeSlots";
import { formatBRL, cn } from "@/lib/utils";
import type { Json } from "@/lib/database.types";
import { HomeModePicker } from "./HomeModePicker";
import { ProAvatar } from "./ProAvatar";
import { ENDERECO_VAZIO, type Endereco } from "@/app/[slug]/HomeAddressForm";
import { maskBrPhone, toStoredPhone } from "@/lib/whatsapp/phone";
import { CircleNotch, X } from "@phosphor-icons/react/dist/ssr";
import type { Client, HomeConfig, Pro, Service } from "./shared";

/**
 * Formulário de novo agendamento.
 *
 * Saiu do AgendaManager para poder abrir de qualquer tela do painel (botão
 * central da barra inferior). Ele não depende da grade: recebe as listas
 * prontas e resolve sozinho os horários livres via `get_availability`.
 */
export function CreateAppointment({
  salonId, pros, services, clients, discounts, date: initialDate, initialPro, initialTime, initialClient, onClose, onCreated,
  homeConfig,
}: {
  salonId: string; pros: Pro[]; services: Service[]; clients: Client[];
  discounts: Record<string, number>;
  /** Ausente ou desligado = a escolha de modalidade nem aparece. */
  homeConfig?: HomeConfig;
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
  const [slot, setSlot]                 = useState<string>("");
  const [slots, setSlots]               = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [err, setErr]                   = useState<string | null>(null);
  const [modo, setModo]                 = useState<"salon" | "home">("salon");
  const [endereco, setEndereco]         = useState<Endereco>(ENDERECO_VAZIO);

  const clienteEscolhido = clients.find(c => c.id === existingClient) ?? null;
  const servicosDeCasa = services.filter(s => s.allows_home_service);
  const temServicoDeCasa = selected.some(id => servicosDeCasa.some(s => s.id === id));
  const emCasa = !!homeConfig?.enabled && modo === "home";
  const [svcSearch, setSvcSearch]       = useState("");
  const [lastSvcs, setLastSvcs]         = useState<{ id: string; name: string }[] | null>(null);

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
        if (clientPhone.trim() !== "" && !toStoredPhone(clientPhone)) {
          setErr("Confira o telefone: celular com DDD, como (11) 98765-4321.");
          setBusy(false); return;
        }
        const { data: c, error: ce } = await supabase
          .from("clients")
          .insert({ salon_id: salonId, full_name: clientName.trim(), phone: toStoredPhone(clientPhone) })
          .select("id").single();
        if (ce) throw ce;
        clientId = c.id;
      }
      const { error } = await supabase.rpc("create_staff_appointment", {
        p_salon: salonId, p_member: proId, p_client: clientId,
        p_service_ids: selected,
        p_starts_at: slot,
        ...(emCasa
          ? {
              p_service_mode: "home",
              // Só manda endereço quando a recepcionista digitou algo; sem
              // isso a RPC usa o que já está na ficha da cliente.
              p_address: endereco.street_number.trim()
                ? (endereco as unknown as Json)
                : null,
            }
          : {}),
      });
      if (error) {
        const m = error.message;
        setErr(
          m.includes("slot_taken")
            ? "A profissional já está ocupada nesse horário."
            : m.includes("client_busy")
              ? "Esta cliente já tem um atendimento nesse horário. Ative simultâneos nas Configurações para permitir."
              : m.includes("home_address_required")
                ? "Informe a rua e o número do atendimento em domicílio."
                : m.includes("service_not_home")
                  ? "Um dos serviços escolhidos não é feito fora do salão."
                  : m.includes("home_needs_client")
                    ? "Escolha uma cliente cadastrada para atendimento em domicílio."
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

  // Em domicílio, só o que sai do salão — igual à página pública.
  const servicosVisiveis = emCasa ? servicosDeCasa : services;
  const filteredServices = svcSearch.trim()
    ? servicosVisiveis.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase()))
    : servicosVisiveis;

  function trocarModo(novo: "salon" | "home") {
    setModo(novo);
    if (novo === "home") {
      const ok = new Set(servicosDeCasa.map(s => s.id));
      setSelected(prev => prev.filter(id => ok.has(id)));
    }
  }

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

  // Um bloco só, desenhado em dois lugares (coluna da direita no desktop, no
  // fluxo no celular) — mesma marcação, sem cópia.
  const blocoServicos = (
    <>
      <Input
        placeholder="Buscar serviço…"
        value={svcSearch}
        onChange={e => setSvcSearch(e.target.value)}
      />
      <div className="space-y-1.5 max-h-52 overflow-auto sm:max-h-none sm:flex-1 sm:pr-0.5">
        {serviceButtons}
      </div>
    </>
  );

  const blocoHorarios = (
    totalDuration <= 0 ? (
      <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        Escolha os serviços primeiro — o horário depende de quanto tempo o
        atendimento leva.
      </p>
    ) : loadingSlots ? (
      <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
        <CircleNotch className="h-3.5 w-3.5 animate-spin" /> Procurando horários livres…
      </p>
    ) : slots.length === 0 ? (
      <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        Nenhum horário livre neste dia para {pros.find(p => p.id === proId)?.name ?? "esta profissional"}.
        Tente outro dia na fita acima.
      </p>
    ) : (
      <TimeSlots dense slots={slots} selected={slot || null} onSelect={setSlot} className="max-h-56 overflow-auto sm:max-h-48" />
    )
  );

  // Botão travado sem explicação é o que faz a pessoa achar que o sistema
  // quebrou. Diz o que falta, na ordem em que ela preencheria.
  const faltando =
    !existingClient && !clientName.trim() ? "Informe o nome da cliente"
      : selected.length === 0 ? "Escolha pelo menos um serviço"
        : !slot ? "Escolha um horário"
          : null;

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-3xl mx-auto max-h-[90vh] overflow-auto sm:overflow-hidden p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold">Novo agendamento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {/* A data atravessa as duas colunas no desktop: ela é o eixo do
            formulário (muda a lista de horários inteira) e, espremida na
            coluna de 240px, a fita mostraria três dias — perdendo o motivo de
            existir. No celular ela volta para o fluxo, na ordem em que se
            preenche. */}
        <div className="hidden sm:block mb-4">
          <Label className="mb-1.5 block">Data</Label>
          <DateStrip value={date} onChange={setDate} />
        </div>

        {/* Desktop: two columns. Mobile: single column */}
        <div className="sm:flex sm:gap-6 sm:min-h-[420px]">

          {/* Left column — fields */}
          <div className="space-y-4 sm:w-60 sm:shrink-0 sm:flex sm:flex-col sm:space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <ClientCombobox
                clients={clients}
                value={existingClient}
                onChange={v => { setExisting(v); setSelected([]); }}
              />
            </div>
            {!existingClient && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} />
                <Input placeholder="Celular" inputMode="numeric" value={clientPhone} onChange={e => setClientPhone(maskBrPhone(e.target.value))} />
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
              {/* Foto no rótulo: em salão com equipe, quem atende se reconhece
                  pelo rosto antes do nome — e a cor do avatar é a mesma que
                  identifica a pessoa na grade da agenda. */}
              <Select value={proId} onValueChange={setProId}>
                {pros.map(p => (
                  <option key={p.id} value={p.id}>
                    {/* inline-flex e não flex: o Select embrulha o rótulo num
                        span com `truncate`, e um filho block quebraria o
                        alinhamento tanto no botão quanto na lista. */}
                    <span className="inline-flex items-center gap-2 align-middle">
                      <ProAvatar pro={p} size={20} />
                      <span>{p.name}</span>
                    </span>
                  </option>
                ))}
              </Select>
            </div>

            {/* Onde vai ser: antes dos serviços, porque muda a lista deles. */}
            {homeConfig?.enabled && (
              <div className="space-y-1.5">
                <Label>Onde</Label>
                <HomeModePicker
                  config={homeConfig}
                  modo={modo}
                  onModo={trocarModo}
                  cliente={clienteEscolhido}
                  endereco={endereco}
                  onEndereco={setEndereco}
                  temServicoDeCasa={temServicoDeCasa}
                />
              </div>
            )}

            {/* Serviços e horários no celular ficam aqui, no fluxo; no desktop
                vão para a coluna da direita. */}
            <div className="space-y-1.5 sm:hidden">
              <Label>Serviços</Label>
              {blocoServicos}
            </div>

            <div className="space-y-1.5 sm:hidden">
              <Label>Data</Label>
              <DateStrip value={date} onChange={setDate} />
            </div>

            <div className="space-y-1.5 sm:hidden">
              <Label>Horário</Label>
              {blocoHorarios}
            </div>

            {/* Resumo antes do botão: o que vai ser criado, em uma linha.
                O "Total" era um campo de formulário que ninguém preenche e
                mostrava R$ 0,00 antes de haver o que somar; aqui ele só
                aparece quando existe conta, junto da duração — que é o número
                que faltava para escolher horário com segurança. */}
            <div className="sm:mt-auto space-y-2 pt-1">
              {chosen.length > 0 && (
                <div className="flex items-baseline justify-between gap-2 rounded-[var(--radius)] bg-muted/50 px-3 py-2">
                  <span className="min-w-0 text-xs text-muted-foreground">
                    <span className="truncate">{chosen.map(s => s.name).join(" + ")}</span>
                    {" · "}
                    {totalDuration >= 60
                      ? `${Math.floor(totalDuration / 60)}h${totalDuration % 60 ? String(totalDuration % 60).padStart(2, "0") : ""}`
                      : `${totalDuration} min`}
                  </span>
                  <span className="shrink-0 font-semibold text-primary">{formatBRL(totalPrice)}</span>
                </div>
              )}

              {err && <p className="text-sm text-red-600">{err}</p>}

              <Button className="w-full" onClick={create} disabled={busy || !!faltando}>
                {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Criar agendamento
              </Button>
              {faltando && (
                <p className="text-center text-xs text-muted-foreground">{faltando}</p>
              )}
            </div>
          </div>

          {/* Coluna da direita (desktop) — o que e quando. Horários logo
              abaixo dos serviços porque um depende do outro: mudar o serviço
              muda a duração e, com ela, a lista de horários. */}
          <div className="hidden sm:flex sm:flex-col sm:flex-1 sm:min-w-0 sm:gap-3">
            <div className="flex min-h-0 flex-1 flex-col">
              <Label className="mb-2">Serviços</Label>
              <div className="flex min-h-0 flex-1 flex-col gap-2">{blocoServicos}</div>
            </div>
            <div className="shrink-0">
              <Label className="mb-2 block">Horário</Label>
              {blocoHorarios}
            </div>
          </div>

        </div>
      </Card>
    </MotionModal>
  );
}
