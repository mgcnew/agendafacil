import Image from "next/image";

/**
 * DevicesShowcase — laptop + celular com CAPTURAS REAIS do produto (não mais
 * mockup abstrato). As imagens em /public são screenshots do painel de agenda
 * e da página de agendamento da cliente, no tema petróleo da marca.
 *
 * Pra atualizar: rode a captura de novo (Playwright) apontando pro salão demo
 * e substitua showcase-agenda.png / showcase-booking.png.
 */

const P = "#0e6f78";   // primary (petróleo)
const PS = "#d9efef";  // secondary (petróleo-50)
const FG = "#0b2127";  // foreground

export function DevicesShowcase() {
  return (
    <div className="relative flex items-end justify-center select-none" style={{ minHeight: 320 }}>

      {/* ── LAPTOP ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[460px]">

        <div className="rounded-t-2xl shadow-2xl overflow-hidden" style={{ background: "#1c1c1e", padding: "8px 8px 0" }}>
          <div className="rounded-t-xl overflow-hidden bg-white">

            {/* Barra do browser */}
            <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "#f0f0f0", borderBottom: "1px solid #e0e0e0" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#febc2e" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28c840" }} />
              <div className="flex-1 mx-2 rounded-full flex items-center px-2 gap-1" style={{ background: "#fff", height: 18, border: "1px solid #ddd" }}>
                <span style={{ fontSize: 7, color: "#999" }}>🔒 zulan.app/painel/meu-salao/agenda</span>
              </div>
            </div>

            {/* Screenshot real do painel de agenda (16:10) */}
            <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
              <Image
                src="/showcase-agenda.png"
                alt="Painel de agenda do Zulan com o assistente do dia e os agendamentos por profissional"
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 90vw, 460px"
              />
            </div>
          </div>
        </div>

        {/* Base do laptop */}
        <div className="h-3 rounded-b-2xl" style={{ background: "#2c2c2e" }} />
        <div className="rounded-full mx-auto" style={{ height: 6, width: "38%", background: "#3a3a3c", marginTop: -1 }} />
      </div>

      {/* ── CELULAR ────────────────────────────────────────────── */}
      <div className="absolute z-20 shadow-2xl" style={{ right: "-10px", bottom: 20, width: 118 }}>
        <div className="rounded-[1.75rem] p-1.5" style={{ background: "#1c1c1e" }}>
          <div className="relative rounded-[1.35rem] overflow-hidden bg-white" style={{ aspectRatio: "390 / 760" }}>

            {/* Dynamic island por cima da captura */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10 rounded-full" style={{ top: 5, width: 34, height: 8, background: "#1c1c1e" }} />

            {/* Screenshot real da página de agendamento da cliente */}
            <Image
              src="/showcase-booking.png"
              alt="Página de agendamento onde a cliente escolhe o serviço pelo celular"
              fill
              className="object-cover object-top"
              sizes="118px"
            />
          </div>
        </div>
      </div>

      {/* Badge flutuante — mesma linguagem do card do hero */}
      <div className="absolute z-30 rounded-2xl shadow-xl flex items-center gap-2 px-3 py-2" style={{ left: "2%", bottom: 64, background: "#fff", border: `1px solid ${PS}` }}>
        <span className="rounded-full flex items-center justify-center shrink-0 text-white" style={{ width: 24, height: 24, background: P, fontSize: 12 }}>✓</span>
        <div className="leading-tight">
          <p style={{ fontSize: 10, fontWeight: 700, color: FG }}>Novo agendamento</p>
          <p style={{ fontSize: 8.5, color: "#6b7280" }}>a cliente marcou sozinha</p>
        </div>
      </div>

    </div>
  );
}
