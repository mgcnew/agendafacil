/**
 * Fallback de Suspense exibido instantaneamente ao navegar entre páginas do
 * painel, enquanto o Server Component busca os dados no Supabase. Sem isto, o
 * usuário ficava preso na página anterior (sem feedback) até as queries
 * terminarem — o que dava a sensação de "delay" a cada clique.
 *
 * A sidebar/layout permanece montada; só esta área de conteúdo troca.
 */
export default function PanelLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-muted" />
          <div className="h-4 w-64 rounded-md bg-muted/70" />
        </div>
        <div className="h-10 w-44 rounded-[var(--radius)] bg-muted" />
      </div>

      {/* Cartões de estatística */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3"
          >
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-7 w-20 rounded-md bg-muted" />
            <div className="h-3 w-24 rounded-md bg-muted/70" />
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <div className="h-5 w-40 rounded-md bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-[var(--radius)] border border-border bg-card"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
