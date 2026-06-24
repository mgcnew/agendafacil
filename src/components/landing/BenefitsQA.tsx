"use client";

import { useState } from "react";
import {
  MessageSquareOff,
  Clock,
  Percent,
  Boxes,
  Users,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

type Item = {
  q: string;
  a: string;
  /** O ganho concreto — frase curta de resultado */
  win: string;
  icon: LucideIcon;
};

const ITEMS: Item[] = [
  {
    q: "Sua cliente ainda agenda pelo WhatsApp?",
    a: "Com o Zulan, cada salão tem um link único. A cliente abre, escolhe serviço, profissional e horário disponível — sem precisar te chamar no WhatsApp. Sua agenda fica sempre organizada, sem mensagem no meio da madrugada.",
    win: "Agenda cheia sem você tocar no celular.",
    icon: MessageSquareOff,
  },
  {
    q: "Quanto tempo gasta confirmando agendamento?",
    a: "Zero. A confirmação sai automática assim que a cliente agenda. Você só abre a agenda e vê tudo organizado — sem precisar digitar uma linha sequer. Mais tempo para atender, menos tempo no celular.",
    win: "Confirmação automática, todas as vezes.",
    icon: Clock,
  },
  {
    q: "Sabe exatamente quanto cada profissional produziu?",
    a: "Cada serviço já carrega a comissão configurada. No fechamento do dia, o sistema calcula tudo automaticamente — sem planilha, sem discussão, sem erro. Sua equipe confia nos números porque são automáticos.",
    win: "Fechamento do mês em minutos, não horas.",
    icon: Percent,
  },
  {
    q: "Controla o estoque sem anotar num caderno?",
    a: "O sistema baixa os produtos usados em cada serviço automaticamente. Emite alerta quando o estoque mínimo é atingido, antes de acabar na hora errada. Chega de ser pego de surpresa durante o atendimento.",
    win: "Alerta antes do produto faltar.",
    icon: Boxes,
  },
  {
    q: "Sabe o histórico completo de cada cliente?",
    a: "Ficha completa com todos os serviços realizados, preferências, anamnese e alertas de saúde. Tudo acessível em segundos — antes mesmo de ela sentar na cadeira. Atendimento personalizado sem depender da memória.",
    win: "A ficha pronta antes da cliente sentar.",
    icon: Users,
  },
  {
    q: "Sua equipe vê o que precisa — e só o que precisa?",
    a: "Permissões por cargo. A recepcionista vê a agenda, o gerente acessa o caixa, e a profissional só enxerga seus próprios atendimentos. Controle total sem complicar a rotina de ninguém.",
    win: "Cada pessoa vê só o que é dela.",
    icon: ShieldCheck,
  },
];

export function BenefitsQA() {
  const [active, setActive] = useState(0);

  return (
    <div className="border-t border-border">
      {ITEMS.map((item, i) => {
        const open = i === active;
        const Icon = item.icon;
        return (
          <div
            key={i}
            className="relative border-b border-border"
            style={{
              background: open
                ? "color-mix(in srgb, var(--primary) 5%, transparent)"
                : undefined,
              transition: "background 0.35s ease",
            }}
          >
            {/* Trilho de acento (cresce quando aberto) */}
            <span
              aria-hidden
              className="absolute left-0 top-0 w-[3px]"
              style={{
                background: "var(--primary)",
                height: "100%",
                transformOrigin: "top",
                transform: open ? "scaleY(1)" : "scaleY(0)",
                transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)",
              }}
            />

            {/* Linha clicável */}
            <button
              onClick={() => setActive(open ? -1 : i)}
              aria-expanded={open}
              className="group w-full flex items-center gap-4 sm:gap-8 py-6 sm:py-8 px-4 sm:px-7 text-left"
            >
              {/* Numeral grande */}
              <span
                className="font-display font-bold tabular-nums shrink-0 leading-none transition-colors duration-300"
                style={{
                  fontSize: "clamp(1.75rem, 4vw, 3rem)",
                  width: "clamp(2.5rem, 6vw, 4rem)",
                  color: open
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--foreground) 18%, transparent)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Pergunta */}
              <span className="flex-1 min-w-0">
                <span
                  className="block font-display font-semibold leading-snug tracking-tight transition-colors"
                  style={{ fontSize: "clamp(1.05rem, 2vw, 1.5rem)" }}
                >
                  {item.q}
                </span>
              </span>

              {/* Botão toggle */}
              <span
                className="grid place-items-center rounded-full shrink-0 transition-all duration-300"
                style={{
                  height: 44,
                  width: 44,
                  background: open ? "var(--primary)" : "var(--card)",
                  border: `1px solid ${open ? "transparent" : "var(--border)"}`,
                  color: open ? "var(--primary-foreground)" : "var(--foreground)",
                  transform: open ? "rotate(45deg)" : "none",
                  boxShadow: open
                    ? "0 8px 20px -6px color-mix(in srgb, var(--primary) 45%, transparent)"
                    : undefined,
                }}
              >
                <Plus className="h-5 w-5" />
              </span>
            </button>

            {/* Conteúdo expansível — truque grid 0fr→1fr (animação suave) */}
            <div
              className="grid"
              style={{
                gridTemplateRows: open ? "1fr" : "0fr",
                transition: "grid-template-rows 0.4s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <div className="overflow-hidden">
                <div
                  className="pb-8 px-4 sm:px-7 flex flex-col gap-5"
                  style={{
                    paddingLeft: "clamp(3.5rem, 12vw, 6rem)",
                  }}
                >
                  <p
                    className="leading-relaxed max-w-2xl"
                    style={{
                      color: "var(--muted-foreground)",
                      fontSize: "1rem",
                    }}
                  >
                    {item.a}
                  </p>

                  {/* Faixa de resultado */}
                  <div
                    className="inline-flex items-center gap-3 self-start rounded-full pl-2 pr-5 py-2"
                    style={{ background: "var(--secondary)" }}
                  >
                    <span
                      className="grid place-items-center h-8 w-8 rounded-full shrink-0"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--secondary-foreground)" }}
                    >
                      {item.win}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Rodapé da seção — CTA discreto */}
      <a
        href="#planos"
        className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
        style={{ color: "var(--primary)" }}
      >
        Ver tudo que vem em cada plano
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}
