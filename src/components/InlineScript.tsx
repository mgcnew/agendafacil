/**
 * Script inline que roda de forma síncrona durante o parse do HTML (antes do
 * primeiro paint), sem disparar o aviso do React sobre <script> renderizado
 * por componente. No servidor vira type="text/javascript" (executa); no
 * cliente vira "text/plain" (inerte) — o suppressHydrationWarning cobre essa
 * troca de atributo entre SSR e hidratação.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Dados estruturados (JSON-LD) para SEO.
 *
 * O React (dev) avisa sempre que um componente renderiza um elemento <script>,
 * porque scripts assim não executam na hidratação do cliente. Como o JSON-LD é
 * só dado (não executa), renderizamos o <script> por dentro do innerHTML de um
 * <div> — o parser do HTML cria a tag (e os buscadores a leem normalmente),
 * mas o React nunca "vê" um <script>, então o aviso não dispara.
 *
 * O `<` é escapado para < (JSON válido) pra evitar que um "</script>" no
 * conteúdo feche a tag antes da hora.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <div
      style={{ display: "none" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: `<script type="application/ld+json">${json}</script>` }}
    />
  );
}
