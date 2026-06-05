import { redirect } from "next/navigation";
import Link from "next/link";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatTime } from "@/lib/utils";
import { CalendarDays, Wallet, Clock, Users, Plus, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Aguardando", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800" },
  in_progress: { label: "Em andamento", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "Concluído", cls: "bg-gray-100 text-gray-700" },
  cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
  no_show: { label: "Faltou", cls: "bg-red-100 text-red-700" },
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const membership = await getMembershipBySlug(slug);
  if (!membership) redirect("/painel");
  const salonId = membership.salon_id;

  const supabase = await createClient();
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const [{ data: todayAppts }, { count: servicesCount }, { count: clientsCount }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, status, total_price, member_id, clients(full_name, alert_summary), salon_members(display_name)")
        .eq("salon_id", salonId)
        .gte("starts_at", startDay)
        .lt("starts_at", endDay)
        .order("starts_at"),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
    ]);

  const appts = todayAppts ?? [];
  const revenue = appts
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((sum, a) => sum + Number(a.total_price), 0);

  const stats = [
    { icon: CalendarDays, label: "Agendamentos hoje", value: String(appts.length) },
    { icon: Wallet, label: "Previsão de hoje", value: formatBRL(revenue) },
    { icon: Sparkles2, label: "Serviços ativos", value: String(servicesCount ?? 0) },
    { icon: Users, label: "Clientes", value: String(clientsCount ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Olá{membership.display_name ? `, ${membership.display_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-muted-foreground text-sm">Aqui está o resumo de hoje.</p>
        </div>
        <Link
          href={`/painel/${slug}/agenda`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Novo agendamento
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[var(--radius)] border border-border bg-card p-5">
            <s.icon className="h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-bold mt-3">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Agenda de hoje */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Agenda de hoje
        </h2>
        {appts.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhum agendamento para hoje ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {appts.map((a) => {
              const st = STATUS[a.status] ?? STATUS.pending;
              const clientObj = a.clients as { full_name?: string; alert_summary?: string | null } | null;
              const client = clientObj?.full_name ?? "Cliente";
              const prof = (a.salon_members as { display_name?: string } | null)?.display_name ?? "";
              return (
                <div key={a.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4">
                  <div className="text-center shrink-0">
                    <p className="font-display font-bold">{formatTime(a.starts_at)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate flex items-center gap-2">
                      {client}
                      {clientObj?.alert_summary && (
                        <span title={clientObj.alert_summary} className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium shrink-0">
                          <AlertTriangle className="h-3 w-3" /> alerta
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{prof}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${st.cls}`}>{st.label}</span>
                  <span className="font-semibold text-primary text-sm">{formatBRL(Number(a.total_price))}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkles2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
