// Página de onboarding do salão. Cria o cliente Supabase no render, então
// não pode ser pré-renderizada estaticamente no build (as chaves só existem
// em runtime). force-dynamic mantém o build verde mesmo sem as env vars
// disponíveis na etapa de build.
import NovoSalaoForm from "./NovoSalaoForm";

export const dynamic = "force-dynamic";

export default function NovoSalaoPage() {
  return <NovoSalaoForm />;
}
