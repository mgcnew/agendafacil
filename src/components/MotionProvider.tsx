"use client";

import { LazyMotion } from "framer-motion";

// Carrega só as features de animação DOM, e sob demanda (chunk separado) —
// o componente `m` + AnimatePresence usam isso. Evita embutir o bundle cheio
// do `motion` nas telas. `strict` garante que usamos `m` (não `motion`).
const loadFeatures = () =>
  import("framer-motion").then((mod) => mod.domAnimation);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
