import { FacebookLogo, InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import { socialLinks } from "@/lib/social";

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
 * `cabecalho` — o cliente ainda vai agendar. Fica no topo, sem rolagem, mas
 * como ícone: aqui a rede é prova social ("tem trabalho publicado, tem
 * avaliação"), não chamada pra ação.
 *
 * `confirmado` — o horário já está marcado. Esse é o único momento em que
 * pedir para seguir não custa conversão nenhuma: a pessoa terminou o que veio
 * fazer, não há mais nada disputando a atenção dela.
 */
export function SocialLinksRow({
  salon,
  variant,
}: {
  salon: Fonte;
  variant: "cabecalho" | "confirmado";
}) {
  const links = socialLinks(salon);

  // `cabecalho` — visível sem rolar, na mesma fileira da galeria e dos "meus
  // agendamentos". Ícone pequeno de propósito: é identidade, não chamada pra
  // ação. Um cartão colorido de Instagram ali em cima competiria com o botão
  // de agendar, e quem sai pro feed antes de marcar costuma não voltar.
  //
  // SÓ Instagram aqui. É a rede onde salão e barbearia publicam trabalho, então
  // é a única que o cliente tem motivo pra abrir ANTES de marcar (quer ver
  // corte, unha, coloração). Facebook e Google não se veem antes: um é presença
  // institucional, o outro é reputação — e reputação pesa depois do
  // atendimento, na mensagem, não numa fileira de ícones no topo.
  if (variant === "cabecalho") {
    if (!links.instagram) return null;
    return (
      <a
        href={links.instagram}
        target="_blank"
        rel="noopener noreferrer"
        title="Instagram"
        aria-label="Ver o Instagram do salão"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <InstagramLogo className="h-[18px] w-[18px]" />
      </a>
    );
  }

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

  return null;
}
