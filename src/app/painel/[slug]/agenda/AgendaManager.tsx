"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, formatTime } from "@/lib/utils";
import type { Enums } from "@/lib/database.types";
import { Plus, Loader2, ChevronLeft, ChevronRight, X, CalendarDays } from "lucide-react";

type Status = Enums<"appointment_status">;
type Pro = { id: string; name: string; commission_percent: number; color: string | null };
type Service = { id: string; name: string; duration_min: number; price: number; commission_percent: number | null };
type Client = { id: string; full_name: string; phone: string | null };
type Appt = {
  id: string;
  starts_at: string;
  status: Status;
  total_price: number;
  member_id: string;
  clients: { full_name: string } | null;
  salon_members: { display_name: string | null } | null;
};

const STATUS: { value: Status; label: string; cls: string }[] = [
  { value: "pending", label: "Aguardando", cls: "bg-amber-100 text-amber-800" },
  { value: "confirmed", label: "Confirmado", cls: "bg-emerald-100 text-emerald-800" },
  { value: "in_progress", label: "Em andamento", cls: "bg-blue-100 text-blue-800" },
  { value: "completed", label: "Concluído", cls: "bg-gray-200 text-gray-700" },
  { value: "cancelled", label: "Cancelado", cls: "bg-red-100 text-red-700" },
  { value: "no_show", label: "Faltou", cls: "bg-red-100 text-red-700" },
];

function addDays(d: string, n: number) {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function AgendaManager({
  salonId,
  pros,
  services,
  clients: initialClients,
}: {
  salonId: string;
  pros: Pro[];
  services: Service[];
  clients: Client[];
}) {
  const supabase = createClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(date + "T00:00:00").toISOString();
    const end = new Date(date + "T23:59:59").toISOString();
    const { data } = await supabase
      .from("appointments")
      .select("id, starts_at, status, total_price, member_id, clients(full_name), salon_members(display_name)")
      .eq("salon_id", salonId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at");
    setAppts((data as Appt[]) ?? []);
    setLoading(false);
  }, [supabase, salonId, date]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function setStatus(a: Appt, status: Status) {
    setAppts((list) => list.map((x) => (x.id === a.id ? { ...x, status } : x)));
    await supabase.from("appointments").update({ status }).eq("id", a.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground text-sm">Gerencie os agendamentos do dia.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Novo agendamento
        </Button>
      </div>

      {/* Navegação de data */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDate((d) => addDays(d, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Button variant="outline" size="sm" onClick={() => setDate((d) => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>
          Hoje
        </Button>
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : appts.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Nenhum agendamento neste dia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appts.map((a) => {
            const st = STATUS.find((s) => s.value === a.status)!;
            return (
              <div key={a.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
                <p className="font-display font-bold w-14 shrink-0">{formatTime(a.starts_at)}</p>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.clients?.full_name ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.salon_members?.display_name ?? ""}</p>
                </div>
                <span className="font-semibold text-primary text-sm hidden sm:inline">{formatBRL(Number(a.total_price))}</span>
                <Select
                  value={a.status}
                  onChange={(e) => setStatus(a, e.target.value as Status)}
                  className={`w-auto h-9 text-xs font-medium border-0 ${st.cls}`}
                >
                  {STATUS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <CreateAppointment
          salonId={salonId}
          pros={pros}
          services={services}
          clients={initialClients}
          date={date}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateAppointment({
  salonId, pros, services, clients, date, onClose, onCreated,
}: {
  salonId: string;
  pros: Pro[];
  services: Service[];
  clients: Client[];
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [existingClient, setExistingClient] = useState("");
  const [proId, setProId] = useState(pros[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chosen = services.filter((s) => selected.includes(s.id));
  const totalPrice = chosen.reduce((a, s) => a + Number(s.price), 0);

  async function create() {
    setBusy(true); setErr(null);
    try {
      let clientId = existingClient || null;

      if (!clientId) {
        if (!clientName) { setErr("Informe o nome da cliente."); setBusy(false); return; }
        const { data: c, error: ce } = await supabase
          .from("clients")
          .insert({ salon_id: salonId, full_name: clientName, phone: clientPhone || null })
          .select("id")
          .single();
        if (ce) throw ce;
        clientId = c.id;
      }

      const startsAt = new Date(`${date}T${time}:00`);
      const { error } = await supabase.rpc("create_staff_appointment", {
        p_salon: salonId,
        p_member: proId,
        p_client: clientId,
        p_service_ids: selected,
        p_starts_at: startsAt.toISOString(),
      });
      if (error) {
        setErr(
          error.message.includes("slot_taken")
            ? "A profissional já está ocupada nesse horário. Escolha outro."
            : "Não foi possível criar o agendamento.",
        );
        setBusy(false);
        return;
      }
      onCreated();
    } catch {
      setErr("Não foi possível criar o agendamento.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full sm:max-w-lg max-h-[88vh] overflow-auto p-6 rounded-b-none sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Novo agendamento</h3>
          <button onClick={onClose} className="p-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={existingClient} onChange={(e) => setExistingClient(e.target.value)}>
              <option value="">+ Nova cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </Select>
          </div>
          {!existingClient && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nome" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <Input placeholder="Celular" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <Select value={proId} onChange={(e) => setProId(e.target.value)}>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Serviços</Label>
            <div className="space-y-1.5 max-h-44 overflow-auto">
              {services.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected((p) => on ? p.filter((x) => x !== s.id) : [...p, s.id])}
                    className={`w-full flex items-center justify-between rounded-[var(--radius)] border p-2.5 text-sm ${on ? "border-primary bg-secondary/40" : "border-border"}`}
                  >
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{formatBRL(Number(s.price))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="h-11 flex items-center font-semibold text-primary">{formatBRL(totalPrice)}</div>
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button className="w-full" onClick={create} disabled={busy || selected.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar agendamento
          </Button>
        </div>
      </Card>
    </div>
  );
}
