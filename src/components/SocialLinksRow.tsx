import { FacebookLogo, GoogleLogo, InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import { socialLinks, instagramHandle } from "@/lib/social";

type Fonte = {
  instagram?: string | null;
  facebook?: string | null;
  google_business?: string | null;
};

/**
 * Redes do salão na página pública.
 *
 * Duas variantes porque são dois momentos diferentes:
 *
 * `rodape` — o cliente ainda vai agendar. Aqui as redes são prova social
 * ("esse lugar existe, tem trabalho publicado, tem avaliação") e por isso
 * ficam discretas, no fim da página: um botão grande de Instagram no topo é
 * uma porta de saída antes da pessoa marcar.
 *
 * `confirmado` — o horário já está marcado. Esse é o único momento em que
 * pedir para seguir não custa conversão: a pessoa terminou o que veio fazer e
 * está satisfeita.
 */
export function SocialLinksRow({
  salon,
  variant,
}: {
  salon: Fonte;
  variant: "rodape" | "confirmado";
}) {
  const links = socialLinks(salon);

  if (variant === "confirmado") {
    // Google fica de fora aqui de propósito: o link dele serve pra avaliação,
    // e quem acabou de marcar ainda não foi atendido — pedir avaliação agora
    // convida a uma nota sobre nada.
    const seguir = [
      links.instagram && { href: links.instagram, Icon: InstagramLogo, label: "Instagram" },
      links.facebook && { href: links.facebook, Icon: FacebookLogo, label: "Facebook" },
    ].filter(Boolean) as { href: string; Icon: typeof InstagramLogo; label: string }[];

    if (seguir.length === 0) return null;

    return (
      <div className="mt-8 rounded-[var(--radius)] border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Acompanhe o trabalho da gente até lá:
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {seguir.map(({ href, Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
            >
              <Icon className="h-4 w-4" /> {label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  const rodape = [
    links.instagram && {
      href: links.instagram,
      Icon: InstagramLogo,
      // O @ é o que a pessoa reconhece e consegue procurar depois; "Instagram"
      // ela já sabe que é.
      label: instagramHandle(links.instagram) ?? "Instagram",
    },
    links.facebook && { href: links.facebook, Icon: FacebookLogo, label: "Facebook" },
    links.google && { href: links.google, Icon: GoogleLogo, label: "Avaliações no Google" },
  ].filter(Boolean) as { href: string; Icon: typeof InstagramLogo; label: string }[];

  if (rodape.length === 0) return null;

  return (
    <div className="mt-10 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {rodape.map(({ href, Icon, label }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-primary"
          >
            <Icon className="h-4 w-4 shrink-0" /> {label}
          </a>
        ))}
      </div>
    </div>
  );
}
