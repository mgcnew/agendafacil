import { ImageResponse } from "next/og";

// Imagem Open Graph gerada dinamicamente (compartilhamento em WhatsApp,
// Facebook, X, LinkedIn). Identidade petróleo + ícone da marca Zulan.
export const runtime = "edge";
export const alt =
  "Zulan — sistema de agendamento online para salões e barbearias";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://agendafacil-chi.vercel.app";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0a565d 0%, #0e6f78 52%, #138a93 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${SITE_URL}/icon-512.png`}
            width={76}
            height={76}
            alt=""
            style={{ borderRadius: 18 }}
          />
          <div style={{ fontSize: 40, fontWeight: 800 }}>Zulan</div>
        </div>

        {/* Mensagem principal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 980,
            }}
          >
            Menos WhatsApp, mais clientes na cadeira.
          </div>
          <div style={{ fontSize: 34, opacity: 0.92, maxWidth: 920 }}>
            Agendamento online para salões, barbearias e estética — agenda,
            comissões, caixa e estoque.
          </div>
        </div>

        {/* Rodapé / selo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              background: "#ffffff",
              color: "#0a565d",
              padding: "14px 28px",
              borderRadius: 999,
            }}
          >
            Teste grátis · 14 dias
          </div>
          <div style={{ fontSize: 26, opacity: 0.9 }}>
            Sem cartão · Cancele quando quiser
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
