"use client";

import { useState } from "react";
import {
  MessageSquareOff,
  Clock,
  Percent,
  Boxes,
  Users,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

type Item = {
  q: string;
  a: string;
  icon: LucideIcon;
};

const ITEMS: Item[] = [
  {
    q: "Sua cliente ainda agenda pelo WhatsApp?",
    a: "Com o AgendeFácil, cada salão tem um link único. A cliente abre, escolhe serviço, profissional e horário disponível — sem precisar te chamar no WhatsApp. Sua agenda fica sempre organizada, sem mensagem no meio da madrugada.",
    icon: MessageSquareOff,
  },
  {
    q: "Quanto tempo gasta confirmando agendamento?",
    a: "Zero. A confirmação sai automática assim que a cliente agenda. Você só abre a agenda e vê tudo organizado — sem precisar digitar uma linha sequer. Mais tempo para atender, menos tempo no celular.",
    icon: Clock,
  },
  {
    q: "Sabe exatamente quanto cada profissional produziu?",
    a: "Cada serviço já carrega a comissão configurada. No fechamento do dia, o sistema calcula tudo automaticamente — sem planilha, sem discussão, sem erro. Sua equipe confia nos números porque são automáticos.",
    icon: Percent,
  },
  {
    q: "Controla o estoque sem anotar num caderno?",
    a: "O sistema baixa os produtos usados em cada serviço automaticamente. Emite alerta quando o estoque mínimo é atingido, antes de acabar na hora errada. Chega de ser pego de surpresa durante o atendimento.",
    icon: Boxes,
  },
  {
    q: "Sabe o histórico completo de cada cliente?",
    a: "Ficha completa com todos os serviços realizados, preferências, anamnese e alertas de saúde. Tudo acessível em segundos — antes mesmo de ela sentar na cadeira. Atendimento personalizado sem depender da memória.",
    icon: Users,
  },
  {
    q: "Sua equipe vê o que precisa — e só o que precisa?",
    a: "Permissões por cargo. A recepcionista vê a agenda, o gerente acessa o caixa, e a profissional só enxerga seus próprios atendimentos. Controle total sem complicar a rotina de ninguém.",
    icon: ShieldCheck,
  },
];

export function BenefitsQA() {
  const [active, setActive] = useState(0);
  const current = ITEMS[active];
  const Icon = current.icon;

  return (
    <div className="grid lg:grid-cols-[1fr_1.15fr] gap-4 lg:gap-6 items-start">

      {/* ── Lista de perguntas ──────────────────────────────── */}
      <ul className="space-y-2">
        {ITEMS.map((item, i) => {
          const Ico = item.icon;
          const isActive = i === active;
          return (
            <li key={i}>
              <button
                onClick={() => setActive(i)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-200"
                style={{
                  background: isActive
                    ? "var(--primary)"
                    : "var(--card)",
                  border: `1px solid ${isActive ? "transparent" : "var(--border)"}`,
                  color: isActive ? "var(--primary-foreground)" : "var(--foreground)",
                  boxShadow: isActive ? "0 4px 14px rgba(14,122,110,0.25)" : undefined,
                }}
              >
                {/* Número */}
                <span
                  className="text-xs font-bold tabular-nums shrink-0"
                  style={{ opacity: isActive ? 0.7 : 0.35, width: 20 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Ícone */}
                <span
                  className="grid place-items-center h-8 w-8 rounded-lg shrink-0 transition-colors"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.18)" : "var(--secondary)",
                  }}
                >
                  <Ico className="h-4 w-4" />
                </span>

                {/* Pergunta */}
                <span className="flex-1 text-sm font-semibold font-display leading-snug">
                  {item.q}
                </span>

                {/* Seta */}
                <ChevronRight
                  className="h-4 w-4 shrink-0 transition-transform duration-200"
                  style={{
                    opacity: isActive ? 1 : 0.35,
                    transform: isActive ? "translateX(2px)" : undefined,
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* ── Painel de resposta ──────────────────────────────── */}
      <div
        className="lg:sticky lg:top-24 rounded-2xl border border-border overflow-hidden"
        style={{ background: "var(--card)" }}
      >
        {/* Topo decorativo laranja */}
        <div
          className="relative h-2 w-full overflow-hidden"
          style={{ background: "var(--secondary)" }}
        >
          <div
            className="absolute inset-0 transition-all duration-500"
            style={{
              background: "linear-gradient(90deg, #f23c10, #ffa504)",
              width: `${((active + 1) / ITEMS.length) * 100}%`,
            }}
          />
        </div>

        {/* Conteúdo */}
        <div className="p-8">
          {/* Ícone grande */}
          <span
            className="grid place-items-center h-16 w-16 rounded-2xl mb-6 transition-colors duration-300"
            style={{ background: "var(--secondary)" }}
          >
            <Icon className="h-8 w-8" style={{ color: "var(--primary)" }} />
          </span>

          {/* Número do item */}
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#f23c10" }}>
            Benefício {String(active + 1).padStart(2, "0")} / {String(ITEMS.length).padStart(2, "0")}
          </p>

          {/* Pergunta */}
          <h3 className="font-display text-xl sm:text-2xl font-semibold leading-snug mb-4">
            {current.q}
          </h3>

          {/* Resposta */}
          <p
            className="leading-relaxed"
            style={{ color: "var(--muted-foreground)", fontSize: "0.95rem" }}
          >
            {current.a}
          </p>

          {/* Navegação inline */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setActive((a) => (a - 1 + ITEMS.length) % ITEMS.length)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Anterior
            </button>
            <div className="flex gap-1.5 flex-1 justify-center">
              {ITEMS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === active ? 20 : 6,
                    height: 6,
                    background: i === active ? "#f23c10" : "var(--border)",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setActive((a) => (a + 1) % ITEMS.length)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              Próximo <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
