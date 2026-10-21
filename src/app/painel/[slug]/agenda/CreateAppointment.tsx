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

// Cada etapa com número: o formulário tem uma ordem (quem → o quê → com quem →
// quando), e o número diz isso sem precisar de texto explicando.
function Etapa({ n, titulo, htmlFor, children }: { n: number; titulo: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background tabular-nums">{n}</span>
        {titulo}
      </Label>
      {children}
    </section>
  );
}

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
          on ? "border-primary bg-secondary ring-1 ring-primary" : "border-border hover:border-foreground/25",
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

  const blocoServicos = (
    <div className="space-y-2">
      <label htmlFor="novo-busca-servico" className="sr-only">Buscar serviço</label>
      <Input
        id="novo-busca-servico"
        placeholder="Buscar serviço…"
        value={svcSearch}
        onChange={e => setSvcSearch(e.target.value)}
      />
      <div className="space-y-1.5 sm:max-h-64 sm:overflow-auto sm:pr-0.5">
        {serviceButtons}
      </div>
    </div>
  );

  const blocoHorarios = (
    totalDuration <= 0 ? (
      <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        Escolha os serviços primeiro — o horário depende de quanto tempo o
        atendimento leva.
      </p>
    ) : loadingSlots ? (
      <p role="status" className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
        <CircleNotch aria-hidden className="h-3.5 w-3.5 animate-spin" /> Procurando horários livres…
      </p>
    ) : slots.length === 0 ? (
      <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        Nenhum horário livre neste dia para {pros.find(p => p.id === proId)?.name ?? "esta profissional"}.
        Tente outro dia acima.
      </p>
    ) : (
      <TimeSlots dense slots={slots} selected={slot || null} onSelect={setSlot} className="max-h-56 overflow-auto" />
    )
  );

  // Botão travado sem explicação é o que faz a pessoa achar que o sistema
  // quebrou. Diz o que falta, na ordem em que ela preencheria.
  const faltando =
    !existingClient && !clientName.trim() ? "Informe o nome da cliente"
      : selected.length === 0 ? "Escolha pelo menos um serviço"
        : !slot ? "Escolha um horário"
          : null;

  const duracao = totalDuration >= 60
    ? `${Math.floor(totalDuration / 60)}h${totalDuration % 60 ? String(totalDuration % 60).padStart(2, "0") : ""}`
    : `${totalDuration} min`;

  return (
    <MotionModal onClose={onClose}>
      <Card className="w-full sm:max-w-4xl mx-auto max-h-[92dvh] flex flex-col overflow-hidden p-0 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h3 className="font-display text-lg font-bold">Novo agendamento</h3>
          <button
            type="button" onClick={onClose} aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo rolável. Desktop: à esquerda quem e o quê; à direita com quem
            e quando. Celular: a mesma ordem numa coluna. */}
        <div className="flex-1 min-h-0 overflow-auto px-5 py-5 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <div className="space-y-6 min-w-0">
              <Etapa n={1} titulo="Cliente">
                <ClientCombobox
                  clients={clients}
                  value={existingClient}
                  onChange={v => { setExisting(v); setSelected([]); }}
                />
                {!existingClient && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Placeholder não é rótulo: some ao digitar e não é lido
                        como nome do campo. */}
                    <label htmlFor="novo-cli-nome" className="sr-only">Nome da cliente</label>
                    <Input id="novo-cli-nome" placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} />
                    <label htmlFor="novo-cli-fone" className="sr-only">Celular da cliente</label>
                    <Input id="novo-cli-fone" placeholder="Celular" inputMode="numeric" value={clientPhone} onChange={e => setClientPhone(maskBrPhone(e.target.value))} />
                  </div>
                )}
                {lastSvcs && (
                  <div className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground truncate">
                      Último: <span className="text-foreground font-medium">{lastSvcs.map(s => s.name).join(", ")}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelected(lastSvcs.map(s => s.id).filter(id => services.some(sv => sv.id === id)))}
                      className="shrink-0 text-xs font-semibold hover:underline"
                    >
                      Repetir
                    </button>
                  </div>
                )}
              </Etapa>

              <Etapa n={2} titulo="Serviços">
                {blocoServicos}
              </Etapa>
            </div>

            <div className="space-y-6 min-w-0">
              <Etapa n={3} titulo="Profissional" htmlFor="novo-profissional">
                {/* Foto no rótulo: a cor do avatar é a mesma que identifica a
                    pessoa na grade da agenda. */}
                <Select id="novo-profissional" value={proId} onValueChange={setProId}>
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
                {/* Onde vai ser: muda a lista de serviços, então fica junto. */}
                {homeConfig?.enabled && (
                  <div className="pt-1">
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
              </Etapa>

              <Etapa n={4} titulo="Dia e horário">
                <DateStrip value={date} onChange={setDate} />
                {blocoHorarios}
              </Etapa>
            </div>
          </div>
        </div>

        {/* Rodapé fixo: o que vai ser criado + a ação, sempre à vista. */}
        <div className="shrink-0 border-t border-border bg-card px-5 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {err && <p role="alert" className="mb-2 text-sm text-red-600">{err}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1 text-sm">
              {chosen.length > 0 ? (
                <p className="truncate">
                  <span className="font-semibold tabular-nums">{formatBRL(totalPrice)}</span>
                  <span className="text-muted-foreground"> · {duracao} · {chosen.map(s => s.name).join(" + ")}</span>
                </p>
              ) : (
                <p className="text-muted-foreground">Nenhum serviço escolhido ainda.</p>
              )}
              {faltando && (
                <p id="novo-falta" className="text-xs text-muted-foreground">{faltando}</p>
              )}
            </div>
            <Button
              className="w-full sm:w-auto sm:min-w-52 rounded-full" onClick={create} disabled={busy || !!faltando}
              // Sem isto o botão travado ficava mudo para leitor de tela.
              aria-describedby={faltando ? "novo-falta" : undefined}
            >
              {busy && <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />}
              {busy ? "Criando…" : "Criar agendamento"}
            </Button>
          </div>
        </div>
      </Card>
    </MotionModal>
  );
}
