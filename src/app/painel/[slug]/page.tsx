import { redirect } from "next/navigation";
import Link from "next/link";
import { getMembershipBySlug } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatTime, startOfTodayBR, startOfTomorrowBR } from "@/lib/utils";
import { CalendarDays, Wallet, Clock, Users, Plus, Package } from "lucide-react";
import { TodayAgenda, type AgendaItem } from "./TodayAgenda";

export const dynamic = "force-dynamic";

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
  // "Hoje" no fuso do Brasil — o servidor roda em UTC em produção.
  const startDay = startOfTodayBR();
  const endDay = startOfTomorrowBR();

  const [{ data: todayAppts }, { count: servicesCount }, { count: clientsCount }, { data: profile }, { data: activePkgs }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, status, total_price, member_id, clients(full_name, alert_summary), salon_members(display_name), appointment_services(name, price, duration_min)")
        .eq("salon_id", salonId)
        .gte("starts_at", startDay)
        .lt("starts_at", endDay)
        .order("starts_at"),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      supabase.from("profiles").select("full_name").eq("id", membership.profile_id).maybeSingle(),
      supabase
        .from("client_packages")
        .select("id, name, expires_at, clients(full_name), client_package_items(total, used)")
        .eq("salon_id", salonId)
        .eq("status", "active")
        .order("expires_at", { ascending: true })
        .limit(6),
    ]);

  const pkgs = (activePkgs ?? []).map((p) => {
    const items = (p.client_package_items as unknown as { total: number; used: number }[]) ?? [];
    const total = items.reduce((a, i) => a + i.total, 0);
    const used = items.reduce((a, i) => a + i.used, 0);
    const dleft = Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / 86400000);
    return {
      id: p.id,
      client: (p.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
      name: p.name,
      remaining: total - used,
      dleft,
    };
  });

  // primeiro nome de quem está logado (perfil > nome de exibição no salão)
  const fullName = (profile?.full_name ?? membership.display_name ?? "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "";

  const appts = todayAppts ?? [];
  const revenue = appts
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((sum, a) => sum + Number(a.total_price), 0);

  const agendaItems: AgendaItem[] = appts.map((a) => {
    const clientObj = a.clients as { full_name?: string; alert_summary?: string | null } | null;
    const svcs = (a.appointment_services as { name: string; price: number; duration_min: number }[] | null) ?? [];
    return {
      id: a.id,
      time: formatTime(a.starts_at),
      client: clientObj?.full_name ?? "Cliente",
      alert: clientObj?.alert_summary ?? null,
      prof: (a.salon_members as { display_name?: string } | null)?.display_name ?? "",
      status: a.status,
      price: Number(a.total_price),
      services: svcs.map((s) => ({ name: s.name, price: Number(s.price), duration: s.duration_min })),
    };
  });

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
            Olá{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-muted-foreground text-sm">Aqui está o resumo de hoje.</p>
        </div>
        <Link
          href={`/painel/${slug}/agenda?novo=1`}
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

      {/* Carnê — pacotes ativos (lembrete) */}
      {pkgs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Pacotes ativos
            </h2>
            <Link href={`/painel/${slug}/pacotes`} className="text-sm text-primary font-medium">
              Ver todos
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pkgs.map((p) => {
              const soon = p.dleft <= 3;
              return (
                <Link
                  key={p.id}
                  href={`/painel/${slug}/pacotes`}
                  className="rounded-[var(--radius)] border border-border bg-card p-3.5 hover:shadow-card transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{p.client}</p>
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${
                      soon ? "bg-red-500/12 text-red-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {p.dleft >= 0 ? `${p.dleft}d` : "vencido"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.name}</p>
                  <p className="text-xs text-primary font-medium mt-1">{p.remaining} restante{p.remaining === 1 ? "" : "s"}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
          <TodayAgenda items={agendaItems} />
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
