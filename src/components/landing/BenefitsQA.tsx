"use client";

import { useState } from "react";
import {
  ArrowRight,
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
  /** Nome curto do módulo — rótulo da lista */
  name: string;
  q: string;
  a: string;
  /** O ganho concreto — frase curta de resultado */
  win: string;
  icon: PhosphorIcon;
};

const ITEMS: Item[] = [
  {
    name: "Agenda e link",
    q: "Sua cliente ainda agenda pelo WhatsApp?",
    a: "Com o Zulan, cada salão tem um link único. A cliente abre, escolhe serviço, profissional e horário disponível — sem precisar te chamar no WhatsApp. Sua agenda fica sempre organizada, sem mensagem no meio da madrugada.",
    win: "Agenda cheia sem você tocar no celular.",
    icon: ChatCircleSlash,
  },
  {
    name: "Confirmação",
    q: "Quanto tempo gasta confirmando agendamento?",
    a: "Zero. A confirmação sai automática assim que a cliente agenda. Você só abre a agenda e vê tudo organizado — sem precisar digitar uma linha sequer. Mais tempo para atender, menos tempo no celular.",
    win: "Confirmação automática, todas as vezes.",
    icon: Clock,
  },
  {
    name: "Caixa e comissões",
    q: "Sabe exatamente quanto cada profissional produziu?",
    a: "Cada serviço já carrega a comissão configurada. No fechamento do dia, o sistema calcula tudo automaticamente — sem planilha, sem discussão, sem erro. Sua equipe confia nos números porque são automáticos.",
    win: "Fechamento do mês em minutos, não horas.",
    icon: Percent,
  },
  {
    name: "Estoque",
    q: "Controla o estoque sem anotar num caderno?",
    a: "O sistema baixa os produtos usados em cada serviço automaticamente. Emite alerta quando o estoque mínimo é atingido, antes de acabar na hora errada. Chega de ser pego de surpresa durante o atendimento.",
    win: "Alerta antes do produto faltar.",
    icon: Stack,
  },
  {
    name: "Clientes",
    q: "Sabe o histórico completo de cada cliente?",
    a: "Ficha completa com todos os serviços realizados, preferências, anamnese e alertas de saúde. Tudo acessível em segundos — antes mesmo de ela sentar na cadeira. Atendimento personalizado sem depender da memória.",
    win: "A ficha pronta antes da cliente sentar.",
    icon: Users,
  },
  {
    name: "Equipe e permissões",
    q: "Sua equipe vê o que precisa — e só o que precisa?",
    a: "Permissões por cargo. A recepcionista vê a agenda, o gerente acessa o caixa, e a profissional só enxerga seus próprios atendimentos. Controle total sem complicar a rotina de ninguém.",
    win: "Cada pessoa vê só o que é dela.",
    icon: ShieldCheck,
  },
];

/** Painel do módulo selecionado — reanima a cada troca (key). */
function Detail({ item, animate }: { item: Item; animate: boolean }) {
  return (
    <div className={`${animate ? "zl-swap" : ""} rounded-[var(--radius-media)] bg-background p-7 sm:p-10`}>
      <h3 className="font-display font-bold text-2xl sm:text-[2rem] leading-tight tracking-[-0.02em] text-balance">
        {item.q}
      </h3>
      <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-[60ch]">
        {item.a}
      </p>
      <p className="mt-8 inline-flex items-center gap-3 rounded-full bg-background px-4 py-2.5 font-semibold">
        <Check className="h-4 w-4 shrink-0 text-[var(--brand)]" weight="bold" />
        {item.win}
      </p>
    </div>
  );
}

export function BenefitsQA() {
  const [active, setActive] = useState(0);
  // Só anima depois da primeira troca: o painel nasce visível.
  const [touched, setTouched] = useState(false);

  function onKey(e: React.KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % ITEMS.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + ITEMS.length) % ITEMS.length;
    if (next < 0) return;
    e.preventDefault();
    setTouched(true);
    setActive(next);
    document.getElementById(`modulo-${next}`)?.focus();
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-12 lg:items-start">
      <div role="tablist" aria-orientation="vertical" aria-label="Módulos do Zulan" className="flex flex-col">
        {ITEMS.map((item, i) => {
          const open = i === active;
          const Icon = item.icon;
          return (
            <div key={item.name} className="border-b border-border first:border-t">
              <button
                id={`modulo-${i}`}
                role="tab"
                aria-selected={open}
                aria-controls="modulo-painel"
                tabIndex={open ? 0 : -1}
                onClick={() => { setTouched(true); setActive(i); }}
                onKeyDown={(e) => onKey(e, i)}
                className="group w-full flex items-center gap-4 py-5 text-left"
              >
                <Icon
                  className={`h-6 w-6 shrink-0 transition-colors ${open ? "text-[var(--brand)]" : "text-foreground/40 group-hover:text-foreground/70"}`}
                  weight={open ? "fill" : "regular"}
                />
                <span
                  className={`flex-1 font-display text-lg sm:text-xl font-bold tracking-[-0.01em] transition-colors ${open ? "text-foreground" : "text-foreground/55 group-hover:text-foreground/80"}`}
                >
                  {item.name}
                </span>
                <ArrowRight
                  aria-hidden
                  className={`hidden lg:block h-5 w-5 shrink-0 transition-all duration-300 ${open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"}`}
                />
              </button>

              {/* Detalhe inline (mobile/tablet) — só do item ativo */}
              {open && (
                <div className="lg:hidden pb-6">
                  <Detail item={item} animate={touched} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div id="modulo-painel" role="tabpanel" aria-labelledby={`modulo-${active}`} className="hidden lg:block lg:sticky lg:top-28">
        <Detail key={active} item={ITEMS[active] ?? ITEMS[0]} animate={touched} />
      </div>
    </div>
  );
}
