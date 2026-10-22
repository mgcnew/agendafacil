import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMembershipBySlug, getEffectivePermissions } from "@/lib/salon";
import { getAccessStatus } from "@/lib/subscription";
import { planAllowsHref } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatTime, formatDate, startOfTodayBR, startOfTomorrowBR, currentMonthBR, monthRangeBR } from "@/lib/utils";
import { daysUntil } from "@/lib/signals/rules";
import { CalendarDots, Wallet, Package, UserCheck, CaretRight, Cake, Plus, CheckCircle, Clock, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { DemoTrialModal } from "./DemoTrialModal";
import { TodayAgenda, type AgendaItem, type AgendaAnamnesis, type AgendaPhoto } from "./TodayAgenda";
import { type BirthdayClient } from "./BirthdayCard";
import { TomorrowReminders } from "./TomorrowReminders";
import { GestorInsightsAsync, GestorInsightsSkeleton } from "./GestorInsights";
import { PrimeirosPassos, type OnboardingStep } from "./PrimeirosPassos";
import { BiometricCard } from "@/components/auth/BiometricCard";
import { NotificationBell, type NotifItem } from "./NotificationBell";
import { UpdatesCard, type UnseenUpdate } from "./UpdatesCard";
import { SITE_URL } from "@/lib/siteUrl";

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
  // Janela de "amanhã" (para os lembretes): [início de amanhã, início de depois de amanhã)
  const tomorrowEnd = (() => {
    const d = new Date(endDay);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  })();

  const isOwner = membership.role === "owner";
  const onboardingDoneAt = (membership.salons as { onboarding_done_at?: string | null }).onboarding_done_at ?? null;
  const needsOnboarding = isOwner && !onboardingDoneAt;

  // Tudo que não depende de outra busca sai num lote só: cada ida ao banco em
  // fila somava uma volta inteira ao tempo de abrir a página.
  const [
    { data: todayAppts }, { count: clientsCount }, { data: profile }, { data: activePkgs },
    { data: reactRaw }, { data: bdayRaw }, { data: tomorrowAppts },
    { data: notifRaw }, { data: unseenRaw }, access, perms, onboardingCounts,
  ] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, status, total_price, member_id, client_id, inspiration_gallery_ids, clients(full_name, alert_summary, photo_url), salon_members(display_name), appointment_services(name, price, duration_min)")
        .eq("salon_id", salonId)
        .gte("starts_at", startDay)
        .lt("starts_at", endDay)
        .order("starts_at"),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      supabase.from("profiles").select("full_name").eq("id", membership.profile_id).maybeSingle(),
      // Pacotes ativos — para o card lateral "Pacotes ativos"
      supabase
        .from("client_packages")
        .select("id, name, expires_at, clients(full_name), client_package_items(total, used)")
        .eq("salon_id", salonId)
        .eq("status", "active")
        .order("expires_at", { ascending: true })
        .limit(6),
      // Clientes para reativar — para o alerta lateral (null p/ quem não tem reports.view)
      supabase.rpc("report_reactivation" as never, { p_salon: salonId, p_min_days: 14 } as never),
      // Aniversários do mês — para o card lateral (o Gestor coleta os dele à parte)
      supabase.rpc("upcoming_birthdays" as never, { p_salon: salonId, p_days: 31 } as never),
      // Agendamentos de amanhã (para lembrar) — só os que ainda vão acontecer
      supabase
        .from("appointments")
        .select("id, starts_at, clients(full_name, phone), appointment_services(name)")
        .eq("salon_id", salonId)
        .gte("starts_at", endDay)
        .lt("starts_at", tomorrowEnd)
        .in("status", ["pending", "confirmed"])
        .order("starts_at"),
      // Notificações do sino (RLS filtra pelo recipient = usuário logado).
      supabase
        .from("notifications")
        .select("id, type, title, body, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(20),
      // Entregas que esta pessoa ainda não viu. A RPC parte da data de criação do
      // perfil, então quem cadastrou hoje não recebe o histórico inteiro como
      // "novidade" (ver 20260803_atualizacoes_2_funcoes.sql).
      supabase.rpc("unseen_product_updates" as never),
      getAccessStatus(slug),
      getEffectivePermissions(salonId, membership),
      // Primeiros passos (só o dono, até concluir ou dispensar)
      needsOnboarding
        ? Promise.all([
            supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true).gt("price", 0),
            supabase.from("salon_members").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
            supabase.from("salon_invites").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
            supabase.from("appointments").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
          ])
        : Promise.resolve(null),
    ]);

  const reactCount = Array.isArray(reactRaw) ? (reactRaw as unknown[]).length : 0;
  const birthdays = (Array.isArray(bdayRaw) ? bdayRaw : []) as BirthdayClient[];

  const reminderItems = (tomorrowAppts ?? []).map((a) => ({
    id: a.id,
    time: formatTime(a.starts_at),
    client: (a.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
    phone: (a.clients as { phone?: string | null } | null)?.phone ?? null,
    services: ((a.appointment_services as { name: string }[] | null) ?? []).map((s) => s.name),
  }));
  const tomorrowLabel = formatDate(endDay);

  const pkgs = (activePkgs ?? []).map((p) => {
    const items = (p.client_package_items as unknown as { total: number; used: number }[]) ?? [];
    const total = items.reduce((a, i) => a + i.total, 0);
    const used = items.reduce((a, i) => a + i.used, 0);
    return {
      id: p.id,
      client: (p.clients as { full_name?: string } | null)?.full_name ?? "Cliente",
      name: p.name,
      remaining: total - used,
      dleft: daysUntil(p.expires_at),
    };
  });

  // primeiro nome de quem está logado (perfil > nome de exibição no salão)
  const fullName = (profile?.full_name ?? membership.display_name ?? "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "";

  // ── Primeiros passos (só o dono, até concluir ou dispensar) ──────────────
  let onboardingSteps: OnboardingStep[] | null = null;
  if (onboardingCounts) {
    const [{ count: pricedCount }, { count: memberCount }, { count: inviteCount }, { count: apptCount }] =
      onboardingCounts;
    const steps: OnboardingStep[] = [
      { done: (pricedCount ?? 0) > 0, title: "Defina os preços dos serviços", hint: "Já deixamos os serviços comuns — agora ajuste os valores.", href: `/painel/${slug}/servicos`, cta: "Ajustar" },
      { done: (clientsCount ?? 0) > 0, title: "Cadastre seu primeiro cliente", hint: "Guarde contato e histórico de quem você atende.", href: `/painel/${slug}/clientes`, cta: "Adicionar" },
      { done: (memberCount ?? 0) > 1 || (inviteCount ?? 0) > 0, title: "Convide sua equipe", hint: "Cada pessoa acessa com o próprio login.", href: `/painel/${slug}/equipe`, cta: "Convidar" },
      { done: (apptCount ?? 0) > 0, title: "Registre o primeiro agendamento", hint: "Marque um horário ou compartilhe seu link.", href: `/painel/${slug}/agenda?novo=1`, cta: "Agendar" },
    ];
    // Some sozinho quando tudo estiver feito.
    if (!steps.every((s) => s.done)) onboardingSteps = steps;
  }

  // ── Minhas comissões (profissional/gerente, só Pro/Max) ──────────
  const earnsCommission = membership.role === "professional" || membership.role === "manager";
  const showMyComm = earnsCommission && planAllowsHref(access?.effective_plan ?? null, "/financeiro");

  const appts = todayAppts ?? [];

  // Ficha de anamnese (RLS por clients.view) e fotos de inspiração das clientes
  // de hoje — 2 buscas leves pra o profissional já ver o essencial na inicial.
  // Saem junto com as comissões: nenhuma depende da outra.
  const clientIds = Array.from(
    new Set(appts.map((a) => a.client_id).filter((x): x is string => !!x)),
  );
  const inspirationIds = Array.from(
    new Set(appts.flatMap((a) => (a.inspiration_gallery_ids as string[] | null) ?? [])),
  );
  const fichasQ = Promise.all([
    clientIds.length
      ? supabase.from("client_anamnesis").select("*").in("client_id", clientIds)
      : Promise.resolve({ data: [] as AgendaAnamnesis[] }),
    inspirationIds.length
      ? supabase.from("salon_gallery").select("id, url, caption").in("id", inspirationIds)
      : Promise.resolve({ data: [] as AgendaPhoto[] }),
  ]);

  let myComm: { earned: number; paid: number; toReceive: number; monthLabel: string } | null = null;
  if (showMyComm) {
    const ym = currentMonthBR();
    const { start, end } = monthRangeBR(ym);
    const periodStartStr = `${ym}-01`;
    const [svc, red, pays] = await Promise.all([
      supabase
        .from("appointment_services")
        .select("commission_amount, appointments!inner(member_id, status, starts_at)")
        .eq("salon_id", salonId)
        .eq("appointments.member_id", membership.id)
        .eq("appointments.status", "completed")
        .gte("appointments.starts_at", start)
        .lte("appointments.starts_at", end),
      supabase
        .from("package_redemptions")
        .select("commission_amount")
        .eq("salon_id", salonId)
        .eq("member_id", membership.id)
        .gte("used_at", start)
        .lte("used_at", end),
      supabase
        .from("commission_payments")
        .select("amount")
        .eq("salon_id", salonId)
        .eq("member_id", membership.id)
        .eq("period_start", periodStartStr),
    ]);
    const earned =
      (svc.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0) +
      (red.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);
    const paid = (pays.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const monthLabel = new Date(`${ym}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    myComm = { earned, paid, toReceive: Math.max(0, earned - paid), monthLabel };
  }

  const revenue = appts
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((sum, a) => sum + Number(a.total_price), 0);

  const [{ data: anamRows }, { data: galleryRows }] = await fichasQ;
  const anamByClient = new Map<string, AgendaAnamnesis>();
  for (const r of (anamRows as AgendaAnamnesis[] | null) ?? []) anamByClient.set(r.client_id, r);
  const photoById = new Map<string, AgendaPhoto>();
  for (const g of (galleryRows as AgendaPhoto[] | null) ?? []) photoById.set(g.id, g);

  const agendaItems: AgendaItem[] = appts.map((a) => {
    const clientObj = a.clients as { full_name?: string; alert_summary?: string | null; photo_url?: string | null } | null;
    const svcs = (a.appointment_services as { name: string; price: number; duration_min: number }[] | null) ?? [];
    const inspiration = ((a.inspiration_gallery_ids as string[] | null) ?? [])
      .map((id) => photoById.get(id))
      .filter((g): g is AgendaPhoto => !!g);
    return {
      id: a.id,
      starts_at: a.starts_at,
      time: formatTime(a.starts_at),
      client: clientObj?.full_name ?? "Cliente",
      clientId: a.client_id ?? null,
      photoUrl: clientObj?.photo_url ?? null,
      alert: clientObj?.alert_summary ?? null,
      anamnesis: (a.client_id && anamByClient.get(a.client_id)) || null,
      inspiration,
      prof: (a.salon_members as { display_name?: string } | null)?.display_name ?? "",
      status: a.status,
      price: Number(a.total_price),
      services: svcs.map((s) => ({ name: s.name, price: Number(s.price), duration: s.duration_min })),
    };
  });

  const notifItems = (notifRaw ?? []) as NotifItem[];

  const unseenUpdates = (Array.isArray(unseenRaw) ? unseenRaw : []) as UnseenUpdate[];

  // ── Números do dia ───────────────────────────────────────────
  // "Agora" do servidor: a página é dinâmica, então é a hora da visita.
  const nowMs = new Date().getTime();
  const validAppts = appts.filter((a) => a.status !== "cancelled");
  const doneAppts = appts.filter((a) => a.status === "completed");
  const noShows = appts.filter((a) => a.status === "no_show").length;
  const realized = doneAppts.reduce((sum, a) => sum + Number(a.total_price), 0);
  const overdueCount = appts.filter(
    (a) => ["pending", "confirmed"].includes(a.status) && new Date(a.starts_at).getTime() < nowMs,
  ).length;
  const aheadCount = appts.filter(
    (a) => a.status === "in_progress" ||
      (["pending", "confirmed"].includes(a.status) && new Date(a.starts_at).getTime() >= nowMs),
  ).length;

  const stats = [
    { label: "Atendidos", value: `${doneAppts.length} de ${validAppts.length - noShows}` },
    { label: "Previsto hoje", value: formatBRL(revenue) },
    { label: "Já realizado", value: formatBRL(realized) },
    { label: "Faltas", value: String(noShows) },
  ];

  const todayLabel = (() => {
    const t = new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo",
    });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();
  const summary =
    aheadCount > 0
      ? `${aheadCount} atendimento${aheadCount === 1 ? "" : "s"} pela frente hoje`
      : validAppts.length > 0
        ? "Nenhum atendimento pela frente hoje"
        : "Agenda livre hoje";

  const canSchedule = perms.has("appointments.manage");

  // ── Precisa de você: o que pede uma ação, em ordem de urgência ─────────
  const birthdaysToday = birthdays.filter((b) => b.days_until === 0);
  const birthdaysSoon = birthdays.filter((b) => b.days_until > 0);
  const pkgsSoon = pkgs.filter((p) => p.dleft <= 3);
  const waBirthday = (b: BirthdayClient) =>
    b.phone
      ? `https://wa.me/55${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Feliz aniversário, ${b.name.split(" ")[0]}! 🎂`)}`
      : null;

  type Todo = { key: string; icon: typeof Clock; text: string; hint?: string; href: string; cta: string; external?: boolean; urgent?: boolean };
  const todos: Todo[] = [
    ...(overdueCount > 0
      ? [{
          key: "baixa", icon: Clock, urgent: true,
          text: `${overdueCount} atendimento${overdueCount === 1 ? "" : "s"} sem baixa`,
          hint: "Já passou do horário: finalize ou marque a falta.",
          href: "#agenda-hoje", cta: "Ver",
        }]
      : []),
    ...birthdaysToday.flatMap((b) => {
      const href = waBirthday(b);
      return href
        ? [{ key: `aniv-${b.id}`, icon: Cake, text: `${b.name.split(" ")[0]} faz aniversário hoje`, hint: b.turning_age ? `${b.turning_age} anos` : undefined, href, cta: "Parabenizar", external: true }]
        : [];
    }),
    ...(reactCount > 0
      ? [{
          key: "reativar", icon: UserCheck,
          text: `${reactCount} cliente${reactCount === 1 ? "" : "s"} para reativar`,
          hint: `${reactCount === 1 ? "Passou" : "Passaram"} do ritmo habitual de retorno.`,
          href: `/painel/${slug}/relatorios?tab=reativacao`, cta: "Ver",
        }]
      : []),
    ...pkgsSoon.map((p) => ({
      key: `pkg-${p.id}`, icon: Package,
      text: `Pacote de ${p.client.split(" ")[0]} ${p.dleft < 0 ? "venceu" : p.dleft === 0 ? "vence hoje" : `vence em ${p.dleft}d`}`,
      hint: `${p.name} · ${p.remaining} restante${p.remaining === 1 ? "" : "s"}`,
      href: `/painel/${slug}/pacotes`, cta: "Ver",
    })),
  ];

  // Salão demo: destaca o link público de agendamento pra o visitante testar
  // a experiência da cliente sem sair do painel de demonstração.
  const isDemo = !!(membership.salons as { is_demo?: boolean }).is_demo;
  const siteUrl = SITE_URL;
  const demoVertical = membership.salons.niche === "barbearia" ? "barbearia" : "salao";

  const card = "rounded-[var(--radius)] border border-border bg-card";

  return (
    <div className="space-y-5 af-rise">
      {/* Demo: passado um tempo de uso, oferece o teste e captura o contato */}
      {isDemo && <DemoTrialModal vertical={demoVertical} />}

      {/* Cabeçalho: o dia, não um cumprimento */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-[-0.02em]">{todayLabel}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {firstName ? `Olá, ${firstName} — ` : ""}{summary}.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell salonId={salonId} initialItems={notifItems} />
          {canSchedule && (
            <Link
              href={`/painel/${slug}/agenda?novo=1`}
              className="hidden lg:inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold transition hover:brightness-110"
            >
              <Plus aria-hidden className="h-4 w-4" weight="bold" /> Agendar
            </Link>
          )}
        </div>
      </div>

      {/* Novidade do produto — uma linha, dispensável */}
      <UpdatesCard updates={unseenUpdates} slug={slug} />

      {/* Convite p/ ativar a digital neste aparelho — some ao ativar/dispensar */}
      <BiometricCard dismissible />

      {/* Primeiros passos — orienta o dono novo; some ao concluir/dispensar */}
      {onboardingSteps && <PrimeirosPassos slug={slug} steps={onboardingSteps} />}

      {/* Números do dia — uma faixa, não quatro cards */}
      <dl className={`${card} grid grid-cols-2 sm:grid-cols-4 divide-border max-sm:[&>div:nth-child(-n+2)]:border-b sm:divide-x [&>div:nth-child(odd)]:max-sm:border-r`}>
        {stats.map((s) => (
          <div key={s.label} className="px-4 py-3.5 sm:px-5">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="font-display text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Desktop: agenda à esquerda; "precisa de você" e o resto à direita.
          Celular: "precisa de você" primeiro, depois a agenda, depois o resto. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:items-start">

        {/* ── Precisa de você ─────────────────────────────────── */}
        <section aria-labelledby="todo-titulo" className={`${card} lg:col-start-2 lg:row-start-1`}>
          <h2 id="todo-titulo" className="flex items-center justify-between px-4 pt-4 pb-2 text-sm font-semibold">
            Precisa de você
            {todos.length > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground tabular-nums">
                {todos.length}
              </span>
            )}
          </h2>
          {todos.length === 0 ? (
            <p className="flex items-center gap-2 px-4 pb-4 text-sm text-muted-foreground">
              <CheckCircle aria-hidden className="h-4 w-4 text-emerald-600" weight="fill" /> Tudo em dia por aqui.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {todos.map((t) => {
                const Icon = t.icon;
                const cls = "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border text-xs font-semibold transition hover:bg-muted";
                return (
                  <li key={t.key} className="flex items-center gap-3 px-4 py-3">
                    <Icon aria-hidden className={`h-5 w-5 shrink-0 ${t.urgent ? "text-amber-600" : "text-foreground/60"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{t.text}</p>
                      {t.hint && <p className="text-xs text-muted-foreground truncate">{t.hint}</p>}
                    </div>
                    {t.external ? (
                      <a href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>
                        {t.cta}<span className="sr-only"> — {t.text}</span>
                      </a>
                    ) : (
                      <Link href={t.href} className={cls}>
                        {t.cta}<span className="sr-only"> — {t.text}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Agenda de hoje ─────────────────────────────────── */}
        <section id="agenda-hoje" aria-labelledby="agenda-hoje-titulo" className="min-w-0 space-y-3 scroll-mt-4 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          {/* Demo: link de agendamento, pra testar a visão da cliente */}
          {isDemo && (
            <div className={`${card} flex flex-wrap items-center gap-3 p-4`}>
              <CalendarDots aria-hidden className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-semibold">Este é o link de agendamento do seu salão</p>
                <p className="text-xs text-muted-foreground break-all">
                  {siteUrl.replace(/^https?:\/\//, "")}/{slug} — é por aqui que a cliente marca sozinha.
                </p>
              </div>
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold transition hover:brightness-110 max-sm:w-full"
              >
                Ver como a cliente agenda <ArrowSquareOut aria-hidden className="h-4 w-4" />
              </a>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 id="agenda-hoje-titulo" className="font-display text-lg font-bold">Agenda de hoje</h2>
            <Link href={`/painel/${slug}/agenda`} className="inline-flex items-center gap-1 rounded text-sm font-medium text-muted-foreground hover:text-foreground">
              Agenda completa <CaretRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
          {appts.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border p-8 text-center">
              <p className="font-medium">Nenhum agendamento para hoje.</p>
              <p className="text-sm text-muted-foreground mt-1">Marque um horário ou mande seu link para as clientes.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {canSchedule && (
                  <Link href={`/painel/${slug}/agenda?novo=1`} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    <Plus aria-hidden className="h-4 w-4" weight="bold" /> Agendar
                  </Link>
                )}
                <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-semibold">
                  Ver meu link <ArrowSquareOut aria-hidden className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : (
            <TodayAgenda items={agendaItems} salonId={salonId} slug={slug} niche={membership.salons.niche} />
          )}
        </section>

        {/* ── Coluna de apoio ────────────────────────────────── */}
        <div className="space-y-5 min-w-0 lg:col-start-2 lg:row-start-2">
          {/* Gestor Zulan — o resumo da IA à vista, não atrás de um ícone.
              Entra por streaming: a IA nunca segura o resto da página. Os
              sinais "de agora" da agenda ficam na própria Agenda; aqui eles
              repetiriam o "sem baixa" de "precisa de você". */}
          <Suspense fallback={<GestorInsightsSkeleton />}>
            <GestorInsightsAsync
              slug={slug}
              supabase={supabase}
              salonId={salonId}
              firstName={firstName}
              salonName={membership.salons.name}
              isDemo={isDemo}
            />
          </Suspense>

          {/* Minhas comissões (profissional/gerente) */}
          {myComm && (
            <div className={`${card} p-4`}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Wallet aria-hidden className="h-4 w-4 text-primary" /> Minhas comissões
                <span className="capitalize font-normal text-muted-foreground text-xs">{myComm.monthLabel}</span>
              </p>
              <p className="font-display text-3xl font-bold tabular-nums mt-2">{formatBRL(myComm.toReceive)}</p>
              <p className="text-xs text-muted-foreground">a receber este mês</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Apurado: <b className="text-foreground">{formatBRL(myComm.earned)}</b></span>
                <span>Já pago: <b className="text-foreground">{formatBRL(myComm.paid)}</b></span>
              </div>
            </div>
          )}

          {/* Lembretes de amanhã — cada um com o botão de mandar */}
          <TomorrowReminders items={reminderItems} dateLabel={tomorrowLabel} salonName={membership.salons.name} />

          {/* Próximos aniversários (os de hoje já estão em "precisa de você") */}
          {birthdaysSoon.length > 0 && (
            <div className={`${card} p-4`}>
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Cake aria-hidden className="h-4 w-4 text-foreground/60" /> Próximos aniversários
              </h2>
              <ul className="space-y-2">
                {birthdaysSoon.slice(0, 4).map((b) => {
                  const href = waBirthday(b);
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.days_until === 1 ? "amanhã" : `em ${b.days_until} dias`}
                          {b.turning_age ? ` · ${b.turning_age} anos` : ""}
                        </p>
                      </div>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Parabenizar ${b.name} no WhatsApp`}
                          className="shrink-0 rounded text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                          Parabenizar
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Pacotes: só o resumo; os que vencem logo já estão em "precisa de você" */}
          {pkgs.length > 0 && (
            <Link
              href={`/painel/${slug}/pacotes`}
              className={`${card} flex items-center gap-3 p-4 transition hover:bg-muted/50`}
            >
              <Package aria-hidden className="h-5 w-5 shrink-0 text-foreground/60" />
              <span className="flex-1 text-sm font-medium">
                {pkgs.length} pacote{pkgs.length === 1 ? "" : "s"} ativo{pkgs.length === 1 ? "" : "s"}
              </span>
              <CaretRight aria-hidden className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
