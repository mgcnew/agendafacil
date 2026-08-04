"use client";

import { useState } from "react";
import { AdminTabs, AdminTabPanel } from "./AdminTabs";
import { SecaoView } from "./BlocosView";
import { ESTRATEGIA } from "@/lib/agentes";
import {
  Brain,
  ChartLineUp,
  Compass,
  Crosshair,
  DoorOpen,
  InstagramLogo,
  ListChecks,
  ShieldWarning,
  Tag,
  Target,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * Playbook de divulgação do Zulan — guia de go-to-market da fase inicial
 * (porta a porta e canais de custo zero). Fica no /admin para estar à mão,
 * inclusive no celular, em campo.
 *
 * O conteúdo NÃO vive aqui: vem de `@/lib/agentes/estrategia`, a mesma fonte
 * que alimenta o pacote baixado pelos agentes de IA. Antes o texto morava
 * dentro deste JSX, e mudar o posicionamento significava mudar em dois lugares
 * — com o risco de o agente passar a dizer ao mercado algo diferente do que
 * você fala na porta do salão.
 *
 * As estimativas de crescimento são premissas explícitas, não promessas.
 */

/** O ícone é decisão de tela, então fica na tela — o conteúdo não sabe disso. */
const ICONES: Record<string, PhosphorIcon> = {
  norte: Compass,
  publico: Target,
  posicao: Crosshair,
  oferta: Tag,
  gatilhos: Brain,
  objecoes: ShieldWarning,
  campo: DoorOpen,
  redes: InstagramLogo,
  metricas: ChartLineUp,
  projecao: TrendUp,
  roteiro: ListChecks,
};

export function PlaybookPanel() {
  const [secao, setSecao] = useState(ESTRATEGIA[0].id);
  const atual = ESTRATEGIA.find((s) => s.id === secao) ?? ESTRATEGIA[0];

  return (
    <div className="space-y-6">
      {/* Sub-navegação por seção. Pastilha em vez de trilha para deixar claro
          que é um nível abaixo das abas do painel. */}
      <AdminTabs
        tabs={ESTRATEGIA.map((s) => ({
          id: s.id,
          label: s.rotulo,
          icon: ICONES[s.id] ?? Compass,
        }))}
        value={secao}
        onChange={setSecao}
        label="Seções do playbook"
        ns="pb-"
        variant="chips"
      />

      <AdminTabPanel id={secao} ns="pb-">
        <SecaoView secao={atual} />
      </AdminTabPanel>
    </div>
  );
}
