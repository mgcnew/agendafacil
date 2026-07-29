import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { ArrowLeft, LockKey } from "@phosphor-icons/react/dist/ssr";

/**
 * Tela de "sem acesso".
 *
 * Substitui o `redirect()` mudo que existia antes: quem clicava num link
 * salvo ou num atalho antigo era jogado na visão geral sem explicação, e a
 * conclusão natural era "o sistema está com problema". Dizer qual permissão
 * falta e a quem pedir transforma um bug aparente em uma instrução.
 *
 * Não expõe nada além do nome da permissão — a mesma frase que o dono lê no
 * painel de Acessos, pra que os dois estejam falando da mesma coisa.
 */
export function AccessDenied({
  slug,
  titulo = "Você não tem acesso a esta tela",
  permissao,
}: {
  slug: string;
  titulo?: string;
  /** Rótulo da permissão, exatamente como aparece em Acessos. */
  permissao?: string;
}) {
  return (
    <Card className="mx-auto mt-8 max-w-lg p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
        <LockKey className="h-7 w-7" weight="fill" />
      </span>

      <h1 className="mt-5 font-display text-xl font-bold">{titulo}</h1>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {permissao ? (
          <>
            Ela depende da permissão{" "}
            <b className="text-foreground">&ldquo;{permissao}&rdquo;</b>, que seu
            cargo não tem. Peça para a pessoa responsável liberar em
            Configurações → Acessos.
          </>
        ) : (
          <>
            Seu cargo não tem acesso a esta parte do sistema. Peça para a pessoa
            responsável liberar em Configurações → Acessos.
          </>
        )}
      </p>

      <Link href={`/painel/${slug}`} className="mt-6 inline-block">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4" /> Voltar para a visão geral
        </Button>
      </Link>
    </Card>
  );
}
