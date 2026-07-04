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
