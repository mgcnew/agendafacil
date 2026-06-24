/**
 * DevicesShowcase — representação estilizada do painel em laptop + celular.
 * Cores alinhadas ao tema petróleo (#0e6f78) da marca AgendeFácil.
 */

const P = "#0e6f78";   // primary (petróleo)
const PS = "#d9efef";  // secondary (petróleo-50)
const PD = "#0a565d";  // dark petróleo text
const FG = "#0b2127";  // foreground

export function DevicesShowcase() {
  return (
    <div className="relative flex items-end justify-center select-none" style={{ minHeight: 320 }}>

      {/* ── LAPTOP ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[440px]">

        <div className="rounded-t-2xl shadow-2xl overflow-hidden" style={{ background: "#1c1c1e", padding: "8px 8px 0" }}>
          <div className="rounded-t-xl overflow-hidden" style={{ aspectRatio: "16/10" }}>

            {/* Barra do browser */}
            <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "#f0f0f0", borderBottom: "1px solid #e0e0e0" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#febc2e" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28c840" }} />
              <div className="flex-1 mx-2 rounded-full flex items-center px-2 gap-1" style={{ background: "#fff", height: 18, border: "1px solid #ddd" }}>
                <span style={{ fontSize: 7, color: "#999" }}>🔒 agendefacil.app/painel/meu-salao/agenda</span>
              </div>
            </div>

            {/* Admin panel */}
            <div className="flex h-full" style={{ background: "#fffbf7" }}>

              {/* Sidebar */}
              <div className="flex flex-col items-center py-3 gap-2.5 shrink-0" style={{ width: 44, background: "#1c0a02" }}>
                {/* Logo mark */}
                <div className="rounded-md mb-1" style={{ width: 22, height: 22, background: P }} />
                {/* Nav items */}
                {[true, false, false, false, false, false, false].map((active, i) => (
                  <div key={i} className="rounded" style={{ width: 28, height: 6, background: active ? P : "rgba(255,255,255,0.15)" }} />
                ))}
              </div>

              {/* Conteúdo principal */}
              <div className="flex-1 p-3 overflow-hidden">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="space-y-1">
                    <div className="rounded" style={{ width: 36, height: 7, background: FG }} />
                    <div className="rounded" style={{ width: 60, height: 5, background: "#d4b8a8" }} />
                  </div>
                  <div className="rounded flex items-center justify-center" style={{ width: 52, height: 16, background: P }}>
                    <div className="rounded" style={{ width: 30, height: 4, background: "rgba(255,255,255,0.7)" }} />
                  </div>
                </div>

                {/* Navegação de data */}
                <div className="flex items-center gap-1 mb-3">
                  {["◂", "Hoje — 5 jun", "▸"].map((t, i) => (
                    <div key={i} className="rounded flex items-center justify-center" style={{ height: 14, width: i === 1 ? 72 : 14, background: PS, fontSize: 5, color: PD }}>
                      {t}
                    </div>
                  ))}
                </div>

                {/* Agendamentos */}
                {[
                  { time: "09:00", name: "Ana Paula — Corte + Escova", color: "#dcfce7", dot: "#22c55e" },
                  { time: "10:30", name: "Rodrigo F. — Degradê + Barba", color: "#dbeafe", dot: "#3b82f6" },
                  { time: "13:00", name: "Carla S. — Progressiva", color: "#fef9c3", dot: "#eab308" },
                  { time: "15:30", name: "Juliana M. — Manicure", color: "#fce7f3", dot: "#ec4899" },
                ].map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 mb-1.5">
                    <span style={{ fontSize: 6, color: "#6b7280", width: 20, textAlign: "right", flexShrink: 0 }}>{a.time}</span>
                    <div className="flex-1 rounded flex items-center gap-1.5 px-2" style={{ background: a.color, height: 17 }}>
                      <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: a.dot }} />
                      <span style={{ fontSize: 5.5, color: "#374151", whiteSpace: "nowrap", overflow: "hidden" }}>{a.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Base do laptop */}
        <div className="h-3 rounded-b-2xl" style={{ background: "#2c2c2e" }} />
        <div className="rounded-full mx-auto" style={{ height: 6, width: "38%", background: "#3a3a3c", marginTop: -1 }} />
      </div>

      {/* ── CELULAR ────────────────────────────────────────────── */}
      <div className="absolute z-20 shadow-2xl" style={{ right: "-12px", bottom: 24, width: 108 }}>
        <div className="rounded-[1.75rem] p-1.5" style={{ background: "#1c1c1e" }}>
          <div className="rounded-[1.35rem] overflow-hidden" style={{ background: "#fff" }}>

            {/* Dynamic island */}
            <div className="flex items-end justify-center pb-0.5" style={{ background: "#1c1c1e", height: 14 }}>
              <div className="rounded-full" style={{ width: 36, height: 8, background: "#2c2c2e" }} />
            </div>

            {/* Página de agendamento da cliente */}
            <div className="p-2 space-y-1.5" style={{ background: "#fffbf7" }}>

              {/* Header do salão */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="rounded-lg shrink-0" style={{ width: 22, height: 22, background: P }} />
                <div className="space-y-1">
                  <div className="rounded" style={{ width: 48, height: 5, background: FG }} />
                  <div className="rounded" style={{ width: 32, height: 4, background: "#d4b8a8" }} />
                </div>
              </div>

              <div className="rounded" style={{ width: 56, height: 4, background: "#d4b8a8", marginBottom: 4 }} />

              {/* Serviços */}
              {[
                { sel: true },
                { sel: false },
                { sel: false },
              ].map((s, i) => (
                <div key={i} className="rounded-xl flex items-center gap-1.5 px-2" style={{ height: 22, background: s.sel ? PS : "#fff", border: `1px solid ${s.sel ? P : "#e5e7eb"}` }}>
                  <div className="rounded shrink-0" style={{ width: 8, height: 8, background: s.sel ? P : PS }} />
                  <div className="flex-1">
                    <div className="rounded" style={{ width: "100%", height: 4, background: s.sel ? PD : "#d1d5db" }} />
                  </div>
                  <div className="rounded" style={{ width: 20, height: 4, background: s.sel ? P : PS }} />
                </div>
              ))}

              {/* Botão agendar */}
              <div className="rounded-xl flex items-center justify-center mt-2" style={{ height: 22, background: P }}>
                <div className="rounded" style={{ width: 50, height: 5, background: "rgba(255,255,255,0.8)" }} />
              </div>
            </div>

            <div className="flex items-center justify-center" style={{ background: "#fffbf7", height: 14 }}>
              <div className="rounded-full" style={{ width: 32, height: 3, background: "#d1d5db" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Badge flutuante */}
      <div className="absolute z-30 rounded-2xl shadow-xl flex items-center gap-2 px-3 py-2" style={{ left: "4%", bottom: 72, background: "#fff", border: `1px solid ${PS}` }}>
        <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 22, height: 22, background: "#fef3e8" }}>
          <span style={{ fontSize: 10, color: P }}>✓</span>
        </div>
        <div className="space-y-0.5">
          <div className="rounded" style={{ width: 60, height: 5, background: FG }} />
          <div className="rounded" style={{ width: 40, height: 4, background: "#d4b8a8" }} />
        </div>
      </div>

    </div>
  );
}
