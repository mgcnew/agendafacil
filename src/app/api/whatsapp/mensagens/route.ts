import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardWhatsApp } from "@/lib/whatsapp/guard";

/**
 * Últimas mensagens da fila do salão.
 *
 * Existe porque sem isso o dono não tinha como responder "a fulana recebeu?".
 * A fila fazia a coisa certa e ninguém via — a ponto de um agendamento de teste
 * cancelado logo após criar parecer defeito, quando o comprovante tinha sido
 * corretamente descartado junto com o agendamento.
 *
 * Passa pelo `guardWhatsApp` (owner/manager) porque aqui aparece o texto das
 * mensagens e o telefone dos clientes.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";

  const guard = await guardWhatsApp(slug);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("whatsapp_outbox")
    .select(
      "id, kind, status, skip_reason, last_error, phone, body, scheduled_for, sent_at, created_at, clients(full_name)",
    )
    .eq("salon_id", guard.ctx.salonId)
    // 30 cobre bem mais que um dia de salão movimentado e cabe numa tela.
    // Isto é diagnóstico ("o que aconteceu agora"), não relatório.
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: "falha_ao_ler" }, { status: 500 });
  }

  return NextResponse.json({
    mensagens: (data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      status: m.status,
      skip_reason: m.skip_reason,
      last_error: m.last_error,
      phone: m.phone,
      body: m.body,
      scheduled_for: m.scheduled_for,
      // `sent_at` é a hora que importa quando existe; senão, quando entrou na fila.
      quando: m.sent_at ?? m.created_at,
      cliente: m.clients?.full_name ?? null,
    })),
  });
}
