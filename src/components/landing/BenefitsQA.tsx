"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ChatCircleSlash,
  Check,
  Clock,
  Percent,
  ShieldCheck,
  Stack,
  Users,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

type Item = {
  q: string;
  a: string;
  /** O ganho concreto — frase curta de resultado */
  win: string;
  icon: PhosphorIcon;
};

const ITEMS: Item[] = [
  {
    q: "Sua cliente ainda agenda pelo WhatsApp?",
    a: "Com o Zulan, cada salão tem um link único. A cliente abre, escolhe serviço, profissional e horário disponível — sem precisar te chamar no WhatsApp. Sua agenda fica sempre organizada, sem mensagem no meio da madrugada.",
    win: "Agenda cheia sem você tocar no celular.",
    icon: ChatCircleSlash,
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
    icon: Stack,
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

const TOTAL = String(ITEMS.length).padStart(2, "0");

/** Cartão de detalhe do item selecionado — reanima a cada troca (key). */
function Detail({ item, index }: { item: Item; index: number }) {
  const Icon = item.icon;
  return (
    <div
      key={index}
      className="af-rise relative overflow-hidden rounded-[calc(var(--radius)*1.4)] border border-border bg-background p-7 sm:p-9"
    >
      {/* Brilho de canto — profundidade sutil na cor da marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)" }}
      />

      <div className="relative flex items-center gap-4">
        <span
          className="grid place-items-center rounded-2xl shrink-0 shadow-sm"
          style={{
            height: 56,
            width: 56,
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          <Icon className="h-7 w-7" weight="duotone" />
        </span>
        <span className="font-display font-bold tabular-nums text-sm tracking-widest text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
          <span className="opacity-40"> / {TOTAL}</span>
        </span>
      </div>

      <h3 className="relative mt-6 font-display font-semibold leading-snug tracking-tight text-2xl sm:text-[1.7rem]">
        {item.q}
      </h3>

      <p className="relative mt-4 leading-relaxed text-muted-foreground">
        {item.a}
      </p>

      {/* Resultado concreto — fecha o raciocínio com o ganho */}
      <div className="relative mt-7 flex items-center gap-3 border-t border-border pt-6">
        <span
          className="grid place-items-center h-8 w-8 rounded-full shrink-0"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          <Check className="h-4 w-4" weight="bold" />
        </span>
        <span className="font-display font-semibold tracking-tight">{item.win}</span>
      </div>
    </div>
  );
}

export function BenefitsQA() {
  const [active, setActive] = useState(0);

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setActive((i + 1) % ITEMS.length);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i - 1 + ITEMS.length) % ITEMS.length);
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10 xl:gap-14 lg:items-start">
      {/* ── Coluna esquerda: lista selecionável ─────────────────────── */}
      <div className="flex flex-col gap-1.5">
        {ITEMS.map((item, i) => {
          const open = i === active;
          const Icon = item.icon;
          return (
            <div key={i}>
              <button
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKey(e, i)}
                aria-expanded={open}
                className="group relative w-full flex items-center gap-4 rounded-2xl px-3.5 py-4 text-left transition-colors duration-300"
                style={{
                  background: open
                    ? "color-mix(in srgb, var(--primary) 7%, transparent)"
                    : "transparent",
                }}
              >
                {/* Trilho de acento à esquerda quando ativo */}
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full"
                  style={{
                    background: "var(--primary)",
                    height: open ? "60%" : "0%",
                    transition: "height 0.35s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />

                {/* Ícone identitário por item */}
                <span
                  className="grid place-items-center rounded-xl shrink-0 transition-all duration-300"
                  style={{
                    height: 44,
                    width: 44,
                    background: open ? "var(--primary)" : "var(--secondary)",
                    color: open ? "var(--primary-foreground)" : "var(--primary)",
                  }}
                >
                  <Icon className="h-[22px] w-[22px]" weight={open ? "fill" : "regular"} />
                </span>

                {/* Número + pergunta */}
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold tabular-nums tracking-widest text-muted-foreground/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="block font-display font-semibold leading-snug tracking-tight transition-colors"
                    style={{
                      fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
                      color: open ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 72%, transparent)",
                    }}
                  >
                    {item.q}
                  </span>
                </span>

                {/* Seta que aparece no ativo/hover (desktop) */}
                <ArrowUpRight
                  aria-hidden
                  className="hidden lg:block h-4 w-4 shrink-0 transition-all duration-300"
                  style={{
                    color: "var(--primary)",
                    opacity: open ? 1 : 0,
                    transform: open ? "translate(0,0)" : "translate(-4px,4px)",
                  }}
                />
              </button>

              {/* Detalhe inline (mobile/tablet) — só do item ativo */}
              <div
                className="grid lg:hidden"
                style={{
                  gridTemplateRows: open ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.4s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-1 pb-3 pt-2">
                    <Detail item={item} index={i} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* CTA discreto */}
        <a
          href="#planos"
          className="group mt-6 inline-flex items-center gap-2 self-start px-3.5 text-sm font-semibold transition-colors"
          style={{ color: "var(--primary)" }}
        >
          Ver tudo que vem em cada plano
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>

      {/* ── Coluna direita: painel de detalhe (desktop) ─────────────── */}
      <div className="hidden lg:block lg:sticky lg:top-24">
        <Detail item={ITEMS[active] ?? ITEMS[0]} index={ITEMS[active] ? active : 0} />
      </div>
    </div>
  );
}
