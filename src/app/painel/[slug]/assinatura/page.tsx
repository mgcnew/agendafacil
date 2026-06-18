import { redirect } from "next/navigation";

// Assinatura virou uma aba dentro de Configurações.
export default async function AssinaturaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/painel/${slug}/configuracoes?tab=assinatura`);
}
