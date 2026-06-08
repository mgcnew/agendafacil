"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Label, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { Clock, Loader2, Check, Copy } from "lucide-react";

type WH = Tables<"working_hours">;
type Pro = { id: string; name: string };
type DayHours = { weekday: number; enabled: boolean; start: string; end: string };

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function buildDays(rows: WH[], memberId: string | null): DayHours[] {
  return WEEKDAYS.map((_, w) => {
    const row = rows.find(
      (r) => r.weekday === w && (memberId ? r.member_id === memberId : r.member_id === null),
    );
    return row
      ? { weekday: w, enabled: true, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) }
      : { weekday: w, enabled: false, start: "09:00", end: "18:00" };
  });
}

export function HoursManager({
  salonId, pros, initialHours, embedded = false,
}: {
  salonId: string;
  pros: Pro[];
  initialHours: WH[];
  /** Quando dentro das tabs de Configurações, esconde o cabeçalho próprio e o max-w */
  embedded?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [allRows, setAllRows] = useState<WH[]>(initialHours);
  const [target, setTarget] = useState<string>(""); // "" = salão padrão
  const [days, setDays] = useState<DayHours[]>(() => buildDays(initialHours, null));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const memberId = target || null;

  function changeTarget(t: string) {
    setTarget(t);
    setDays(buildDays(allRows, t || null));
    setSaved(false);
  }

  function setDay(w: number, patch: Partial<DayHours>) {
    setDays((d) => d.map((x) => (x.weekday === w ? { ...x, ...patch } : x)));
  }

  function copyToAll(from: DayHours) {
    setDays((d) => d.map((x) => (x.enabled ? { ...x, start: from.start, end: from.end } : x)));
  }

  async function save() {
    setSaving(true);
    setSaved(false);

    let del = supabase.from("working_hours").delete().eq("salon_id", salonId);
    del = memberId ? del.eq("member_id", memberId) : del.is("member_id", null);
    await del;

    const rows = days
      .filter((d) => d.enabled && d.start < d.end)
      .map((d) => ({
        salon_id: salonId,
        member_id: memberId,
        weekday: d.weekday,
        start_time: d.start,
        end_time: d.end,
      }));

    let inserted: WH[] = [];
    if (rows.length) {
      const { data } = await supabase.from("working_hours").insert(rows).select();
      inserted = (data as WH[]) ?? [];
    }

    // atualiza cache local
    setAllRows((prev) => [
      ...prev.filter((r) => (memberId ? r.member_id !== memberId : r.member_id !== null)),
      ...inserted,
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 max-w-2xl"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold">Horários</h1>
          <p className="text-muted-foreground text-sm">
            Defina o expediente do salão e, se quiser, horários próprios por profissional.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="target">Editando</Label>
        <Select id="target" value={target} onValueChange={changeTarget}>
          <option value="">Salão (padrão)</option>
          {pros.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        {memberId && (
          <p className="text-xs text-muted-foreground">
            Sem horário próprio, a profissional usa o padrão do salão. Ative os dias para criar um horário só dela.
          </p>
        )}
      </div>

      <Card className="p-4 sm:p-6 space-y-2">
        {days.map((d) => (
          <div key={d.weekday} className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-2.5">
            <button
              type="button"
              onClick={() => setDay(d.weekday, { enabled: !d.enabled })}
              className={`relative h-6 w-11 rounded-full transition shrink-0 ${d.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
              aria-label={`Alternar ${WEEKDAYS[d.weekday]}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${d.enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
            <span className="w-20 text-sm font-medium">{WEEKDAYS[d.weekday]}</span>
            {d.enabled ? (
              <div className="flex items-center gap-2 ml-auto">
                <input type="time" value={d.start} onChange={(e) => setDay(d.weekday, { start: e.target.value })} className="h-9 rounded-[var(--radius)] border border-border bg-card px-2 text-sm" />
                <span className="text-muted-foreground text-sm">às</span>
                <input type="time" value={d.end} onChange={(e) => setDay(d.weekday, { end: e.target.value })} className="h-9 rounded-[var(--radius)] border border-border bg-card px-2 text-sm" />
                <button
                  type="button"
                  title="Copiar este horário para os outros dias ativos"
                  onClick={() => copyToAll(d)}
                  className="p-1.5 text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <span className="ml-auto text-sm text-muted-foreground">Fechado</span>
            )}
          </div>
        ))}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
          Salvar horários
        </Button>
        {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" /> Salvo!</span>}
      </div>
    </div>
  );
}
