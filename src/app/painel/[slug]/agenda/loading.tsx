/**
 * Skeleton específico da Agenda — o layout de calendário difere muito do
 * skeleton genérico (stats + lista), então um placeholder em formato de
 * agenda reduz o "salto" de layout ao carregar.
 */
export default function AgendaLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando agenda">
      {/* Barra de controles: navegação de data + alternador de visão */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-[var(--radius)] bg-muted" />
          <div className="h-9 w-40 rounded-[var(--radius)] bg-muted" />
          <div className="h-9 w-9 rounded-[var(--radius)] bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-[var(--radius)] bg-muted/70" />
          <div className="h-9 w-36 rounded-[var(--radius)] bg-muted" />
        </div>
      </div>

      {/* Grade de horários */}
      <div className="rounded-[var(--radius)] border border-border bg-card overflow-hidden">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-stretch gap-3 border-b border-border last:border-0 p-3">
            <div className="h-5 w-12 rounded bg-muted/70 shrink-0" />
            <div
              className="flex-1 rounded-[var(--radius)] bg-muted"
              style={{ height: 44, opacity: i % 3 === 0 ? 1 : i % 3 === 1 ? 0.6 : 0.3 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
