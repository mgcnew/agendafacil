/**
 * Script inline que roda de forma síncrona durante o parse do HTML (antes do
 * primeiro paint) — ex.: aplicar o modo noturno antes de pintar, evitando o
 * flash de tela clara.
 *
 * Renderizado por DENTRO do innerHTML de um <div> (não como elemento <script>
 * próprio): o parser do HTML cria a tag e executa o script na carga inicial
 * (SSR), mas o React nunca "vê" um <script>, então o aviso de dev
 * ("Encountered a script tag while rendering React component") não dispara.
 * Em navegação client-side não re-executa — e nem precisa: sem reload não há
 * flash de tema pra prevenir (mesmo efeito prático do antigo type="text/plain").
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <div
      style={{ display: "none" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: `<script>${html}</script>` }}
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
