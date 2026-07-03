"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissOnboarding } from "./onboardingActions";

/** "Já conheço" — esconde o checklist de vez (otimista + persiste). */
export function DismissOnboardingButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useState(false);
  const router = useRouter();

  if (gone) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setGone(true);
        startTransition(async () => {
          await dismissOnboarding(slug);
          router.refresh();
        });
      }}
      className="text-xs text-muted-foreground/80 transition hover:text-foreground disabled:opacity-50"
    >
      Já conheço
    </button>
  );
}
