import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Horários virou uma tab dentro de Configurações.
 * Mantemos a rota antiga redirecionando para não quebrar links/favoritos.
 */
export default async function HorariosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/painel/${slug}/configuracoes?tab=horarios`);
}
