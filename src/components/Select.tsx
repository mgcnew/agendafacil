"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

type Opt = { value: string; label: React.ReactNode; disabled?: boolean };

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  /** <option value="x">Rótulo</option> */
  children?: React.ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Select com UI própria (botão + listbox em popover via portal), consistente
 * com o tema. Aceita os mesmos <option> de um select nativo; troque apenas
 * `onChange={(e)=>set(e.target.value)}` por `onValueChange={set}`.
 */
export function Select({
  value,
  onValueChange,
  children,
  id,
  className,
  disabled,
  placeholder,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  // tema do ancestral (o portal fica fora do wrapper [data-niche]/[data-color])
  const [theme, setTheme] = React.useState<{ niche?: string; color?: string }>({});
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const options: Opt[] = React.useMemo(() => {
    const out: Opt[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === "option") {
        const p = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
        out.push({ value: String(p.value ?? ""), label: p.children, disabled: p.disabled });
      }
    });
    return out;
  }, [children]);

  const selected = options.find((o) => o.value === value);

  const updateRect = React.useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, []);

  function openMenu() {
    if (disabled) return;
    updateRect();
    const host = btnRef.current?.closest("[data-niche]") as HTMLElement | null;
    setTheme({ niche: host?.dataset.niche, color: host?.dataset.color });
    setOpen(true);
  }

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          "disabled:opacity-60 disabled:pointer-events-none",
          open && "ring-2 ring-[var(--ring)]",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder ?? "Selecione"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && rect && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          data-niche={theme.niche}
          data-color={theme.color}
          style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width }}
          className="z-[60] max-h-60 overflow-auto rounded-[var(--radius)] border border-border bg-card p-1 shadow-xl text-foreground"
        >
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                disabled={o.disabled}
                onClick={() => {
                  onValueChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-[calc(var(--radius)-0.35rem)] px-2.5 py-2 text-left text-sm transition",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  on ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
                )}
              >
                <span className="truncate">{o.label}</span>
                {on && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
