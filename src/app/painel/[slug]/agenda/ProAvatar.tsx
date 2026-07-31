import type { Pro } from "./shared";

/**
 * Cores de rodízio para profissional sem cor escolhida. Vivem aqui e não no
 * AgendaManager porque agora a grade e o formulário de novo agendamento
 * desenham o mesmo avatar — e duas paletas divergindo fariam a mesma pessoa
 * aparecer roxa numa tela e azul na outra.
 */
export const PALETTE = [
  "#6366f1", "#ec4899", "#8b5cf6", "#3b82f6",
  "#14b8a6", "#a855f7", "#0ea5e9", "#d946ef",
  "#06b6d4", "#7c3aed",
];

export function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Avatar do profissional: foto, ou iniciais sobre a cor dele. */
export function ProAvatar({ pro, size = 24 }: { pro: Pro; size?: number }) {
  if (pro.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pro.photo_url}
        alt={pro.name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full grid place-items-center text-white font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: pro.color ?? PALETTE[0],
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials(pro.name)}
    </span>
  );
}
