"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, CalendarPlus, CalendarX, Clock, Trash } from "@phosphor-icons/react/dist/ssr";

export type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Sino de notificações do painel — mostra novos agendamentos e cancelamentos
 * (alimentado pelo trigger notify_appointment_event). Abrir marca as não-lidas
 * como lidas (zera o badge). Fica vivo por realtime: assina appointments (já
 * publicado) e recarrega a lista quando algo muda no salão.
 */
export function NotificationBell({ salonId, initialItems }: { salonId: string; initialItems: NotifItem[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<NotifItem[]>(initialItems);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((i) => !i.read_at).length;

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setItems(data as NotifItem[]);
  }, [supabase]);

  // Realtime: qualquer mudança em appointments do salão → recarrega (a linha
  // de notificação é inserida na mesma transação, então já estará lá).
  useEffect(() => {
    const channel = supabase
      .channel(`notif:${salonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
        () => { refetch(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, salonId, refetch]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const [clearing, setClearing] = useState(false);

  async function toggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
      await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    }
  }

  async function clearAll() {
    if (items.length === 0) return;
    setClearing(true);
    const prev = items;
    setItems([]); // some na hora; RLS garante que só apaga as do próprio usuário
    const { error } = await supabase.from("notifications").delete().not("id", "is", null);
    setClearing(false);
    if (error) setItems(prev); // restaura se falhou
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificações"
        className="relative inline-flex items-center justify-center h-10 w-10 rounded-[var(--radius)] border border-border hover:bg-muted transition"
      >
        <Bell className="h-5 w-5" weight={unread > 0 ? "fill" : "regular"} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] z-50 rounded-[var(--radius)] border border-border bg-card shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Notificações</p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition"
              >
                <Trash className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>
          <div className="max-h-[22rem] overflow-auto">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação.</p>
            ) : (
              items.map((n) => {
                const cancelled = n.type === "appointment_cancelled";
                const reminder = n.type === "appointment_reminder";
                const Icon = cancelled ? CalendarX : reminder ? Clock : CalendarPlus;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/60 last:border-0 ${n.read_at ? "" : "bg-primary/[0.04]"}`}
                  >
                    <span
                      className={`grid place-items-center h-8 w-8 shrink-0 rounded-full ${
                        cancelled
                          ? "bg-red-500/12 text-red-600"
                          : reminder
                          ? "bg-amber-500/12 text-amber-600"
                          : "bg-emerald-500/12 text-emerald-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">{relativeTime(n.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
