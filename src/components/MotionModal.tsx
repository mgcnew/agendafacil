"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

export function MotionModal({
  onClose,
  children,
}: {
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const [attrs, setAttrs] = useState<{ niche?: string; color?: string }>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = document.querySelector("[data-niche]");
    setAttrs({
      niche: el?.getAttribute("data-niche") ?? undefined,
      color: el?.getAttribute("data-color") ?? undefined,
    });
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      data-niche={attrs.niche}
      data-color={attrs.color}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center text-foreground bg-transparent"
    >
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        className="relative w-full"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}
